import { searchBrandedD1, getFoodDetailD1, type D1SearchResult } from "./d1Search";

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60;
const SEARCH_CACHE_MAX_ENTRIES = 500;
const SEARCH_RESULT_LIMIT = 25;

/** Shape returned by GET /barcode — mirrors the client PrefillData type. */
type BarcodeProduct = {
  name: string;
  brand: string | null;
  serving: string;
  calories: number;
  protein: string;
  carbs: string;
  fat: string;
};

/** Shape returned by GET /recipe. */
type ImportedRecipe = {
  name: string;
  servings: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
};

type CacheEntry<T> = { expiresAt: number; value: T };

/** Shape returned by the worker's search endpoint (GET /). Served entirely
 * from the D1 food database — see scripts/food-pipeline/ for how it's built. */
export type WorkerFood = {
  id: number;
  name: string;
  brand: string | null;
  brandName: string | null;
  category: string | null;
  ingredients: string | null;
  dataType: string | undefined;
  servingSize: string;
  /** Raw household-serving text from D1 (e.g. "2 tbsp", "1 can"), when set —
   * often just a restatement of servingSize in g/ml; the client decides
   * whether it's actually useful as a display unit. */
  householdServing?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  isSearchPreview?: boolean;
  /** True for canonical entries served from D1 (deduped offline pipeline). */
  canonical?: boolean;
  /** True when the query matched this food's brand in the D1 brands table. */
  brandMatch?: boolean;
};

const searchCache = new Map<string, CacheEntry<WorkerFood[]>>();
const barcodeCache = new Map<string, CacheEntry<BarcodeProduct>>();
const recipeCache = new Map<string, CacheEntry<ImportedRecipe>>();

const WORKER_USER_AGENT = "JessicaApp/1.0 (https://chibster91.github.io/Jessica-App/)";
// Recipe sites commonly reject non-browser agents, so mimic a real browser for those fetches.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type WorkerEnv = Env;

const ALLOWED_ORIGINS = new Set([
  "https://chibster91.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  // LAN address for testing the dev build on a phone over local Wi-Fi.
  "http://192.168.1.144:5173",
]);

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const response = await routeRequest(request, env);
    const origin = request.headers.get("Origin");
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.append("Vary", "Origin");
    }

    return response;
  },
};

async function routeRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/detail") {
    return handleDetail(url, env);
  }
  if (url.pathname === "/barcode") {
    return handleBarcode(url);
  }
  if (url.pathname === "/recipe") {
    return handleRecipe(url);
  }

  const query = url.searchParams.get("query") || "egg";
  const searchCacheKey = normalizeSearchForMatching(query);
  const cachedSearch = searchCache.get(searchCacheKey);
  if (cachedSearch && cachedSearch.expiresAt > Date.now()) {
    return json(cachedSearch.value, 200, SEARCH_CACHE_TTL_MS / 1000);
  }
  searchCache.delete(searchCacheKey);

  if (!env.FOODS_DB) {
    return json({ error: "Food database is not configured." }, 500);
  }

  let d1Result: D1SearchResult | null;
  try {
    d1Result = await searchBrandedD1(env.FOODS_DB, query);
  } catch (error) {
    console.error("D1 food search failed", error);
    return json({ error: "Food database search failed." }, 500);
  }

  const scored: ScoredFood[] = (d1Result?.foods ?? []).map(({ food, quality }) => ({
    food,
    score: rankSearchResult(food, query) + Math.min(quality, 15) * 2,
  }));
  // Same product at different pack sizes lands as separate D1 rows (OpenNutrition
  // ships one row per barcode, not one per product) — collapse by name+brand,
  // keeping the best-scored copy, so pack-size variants don't crowd the list.
  const foods: WorkerFood[] = dedupeByNameAndBrand(scored)
    .slice(0, SEARCH_RESULT_LIMIT)
    .map((r) => r.food);

  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(searchCacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value: foods });

  return json(foods, 200, SEARCH_CACHE_TTL_MS / 1000);
}

type ScoredFood = { food: WorkerFood; score: number };

/** Dedup key for a food name: drop comma segments that only repeat words from the
 * leading segment ("HAZELNUT SPREAD WITH COCOA, COCOA" → "hazelnut spread with cocoa"),
 * so stutter-named duplicates of one product collapse to a single key. */
function nameDedupKey(name: string): string {
  const [first, ...rest] = name.split(",").map((segment) => normalizeSearchForMatching(segment)).filter(Boolean);
  if (!first) return normalizeSearchForMatching(name);
  const firstWords = new Set(first.split(/\s+/));
  const kept = [first];
  for (const segment of rest) {
    if (!segment.split(/\s+/).every((word) => firstWords.has(word))) kept.push(segment);
  }
  return kept.join(" ");
}

/** Collapse near-duplicate records — the same food name under the same brand
 * (typically different pack sizes/barcodes of one product) — keeping the
 * best-scored copy. */
function dedupeByNameAndBrand(entries: ScoredFood[]): ScoredFood[] {
  const byKey = new Map<string, ScoredFood>();
  for (const entry of entries) {
    const brandKey = normalizeSearchForMatching(entry.food.brandName ?? entry.food.brand ?? "");
    const key = `${nameDedupKey(entry.food.name)}|${brandKey}`;
    const existing = byKey.get(key);
    if (!existing || entry.score > existing.score) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

async function handleDetail(url: URL, env: WorkerEnv): Promise<Response> {
  const id = url.searchParams.get("id");
  if (!id) {
    return json({ error: "Missing required id query parameter." }, 400);
  }
  if (!/^\d+$/.test(id)) {
    return json({ error: "id must be a numeric food ID." }, 400);
  }
  if (!env.FOODS_DB) {
    return json({ error: "Food database is not configured." }, 500);
  }

  try {
    const detail = await getFoodDetailD1(env.FOODS_DB, Number(id));
    if (detail) {
      return json(detail, 200, DETAIL_CACHE_TTL_MS / 1000);
    }
  } catch (error) {
    console.error("D1 detail lookup failed", error);
    return json({ error: "Food database lookup failed." }, 500);
  }

  return json({ error: "Food not found." }, 404);
}

function rankSearchResult(food: WorkerFood, query: string): number {
  const queryText = normalizeSearchForMatching(query);
  const queryWords = getSearchWords(queryText);
  const name = normalizeSearchForMatching(food.name);
  const brand = normalizeSearchForMatching(food.brand ?? "");
  const category = normalizeSearchForMatching(food.category ?? "");
  const searchableText = `${name} ${brand} ${category}`.trim();
  const matchedNameWords = queryWords.filter((word) => hasSearchWord(name, word));
  const matchedWords = queryWords.filter((word) => hasSearchWord(searchableText, word));
  let score = 0;

  if (searchableText.includes(queryText)) score += 120;
  if (matchedWords.length === queryWords.length && queryWords.length > 0) score += 90;
  if (name.includes(queryText)) score += 80;
  if (brand && queryText.includes(brand)) score += 55;
  if (brand && getSearchWords(brand).every((word) => hasSearchWord(queryText, word))) score += 35;
  score += matchedWords.length * 16;
  score += matchedNameWords.length * 12;

  if (isBasicSearchQuery(queryText) && /\b(raw|cooked|plain)\b/.test(name)) {
    score += 15;
  }

  for (const term of ["juice", "candied", "drink", "sauce", "pie", "snack", "candy", "mix"]) {
    if (hasSearchWord(name, term) && !hasSearchWord(queryText, term)) {
      score -= 25;
    }
  }

  if (queryWords.length > 1 && matchedWords.length === 1) score -= 45;

  return score;
}

function isBasicSearchQuery(queryText: string): boolean {
  return queryText.split(/\s+/).filter(Boolean).length <= 2;
}

function hasSearchWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(text);
}

function normalizeSearchText(value: unknown): string {
  return String(value || "").toLowerCase();
}

function normalizeSearchForMatching(value: unknown): string {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function getSearchWords(value: string): string[] {
  return value.split(/\s+/).filter((word) => word.length > 1);
}

// ── Barcode lookup (Open Food Facts) ─────────────────────────────

async function handleBarcode(url: URL): Promise<Response> {
  const code = url.searchParams.get("code");
  if (!code || !/^\d{8,14}$/.test(code)) {
    return json({ error: "A numeric barcode (8–14 digits) is required." }, 400);
  }

  const cached = barcodeCache.get(code);
  if (cached && cached.expiresAt > Date.now()) {
    return json(cached.value);
  }
  barcodeCache.delete(code);

  const offUrl = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,brands,serving_size,nutriments`;
  let payload: OffProductResponse;
  try {
    const r = await fetch(offUrl, { headers: { "User-Agent": WORKER_USER_AGENT } });
    if (!r.ok) {
      return json({ error: "Open Food Facts request failed.", status: r.status }, 502);
    }
    payload = (await r.json()) as OffProductResponse;
  } catch {
    return json({ error: "Could not reach Open Food Facts." }, 502);
  }

  if (payload.status !== 1 || !payload.product) {
    return json({ error: "Product not found." }, 404);
  }

  const product = mapOffProduct(payload.product);
  barcodeCache.set(code, { expiresAt: Date.now() + DETAIL_CACHE_TTL_MS, value: product });
  return json(product);
}

type OffNutriments = Record<string, number | string | undefined>;
type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
};
type OffProductResponse = { status?: number; product?: OffProduct };

function offNumber(nutriments: OffNutriments, key: string): number | null {
  const raw = nutriments[key];
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? parseFloat(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/** Prefer per-serving values, fall back to per-100g. */
function offMacro(nutriments: OffNutriments, base: string): { value: number; perServing: boolean } {
  const serving = offNumber(nutriments, `${base}_serving`);
  if (serving !== null) return { value: serving, perServing: true };
  return { value: offNumber(nutriments, `${base}_100g`) ?? 0, perServing: false };
}

function mapOffProduct(product: OffProduct): BarcodeProduct {
  const nutriments = product.nutriments ?? {};
  const calories = offMacro(nutriments, "energy-kcal");
  const protein = offMacro(nutriments, "proteins");
  const carbs = offMacro(nutriments, "carbohydrates");
  const fat = offMacro(nutriments, "fat");

  const usePerServing = calories.perServing;
  const serving = usePerServing && product.serving_size ? product.serving_size : usePerServing ? "1 serving" : "100 g";

  const round = (n: number) => Math.round(n);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const brand = (product.brands || "").split(",")[0].trim() || null;

  return {
    name: (product.product_name || "").trim() || "Scanned product",
    brand,
    serving,
    calories: round(calories.value),
    protein: String(round1(protein.value)),
    carbs: String(round1(carbs.value)),
    fat: String(round1(fat.value)),
  };
}

// ── Recipe import (schema.org JSON-LD) ───────────────────────────

async function handleRecipe(url: URL): Promise<Response> {
  const target = url.searchParams.get("url");
  if (!target) {
    return json({ error: "A recipe URL is required." }, 400);
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return json({ error: "That doesn't look like a valid URL." }, 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return json({ error: "Only http(s) URLs are supported." }, 400);
  }
  if (isBlockedHost(parsed.hostname)) {
    return json({ error: "That host is not allowed." }, 400);
  }

  const cacheKey = parsed.toString();
  const cached = recipeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return json(cached.value);
  }
  recipeCache.delete(cacheKey);

  let html: string;
  try {
    const r = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!r.ok) {
      return json({ error: "Could not fetch that page.", status: r.status }, 502);
    }
    html = await r.text();
  } catch {
    return json({ error: "Could not fetch that page." }, 502);
  }

  const recipeNode = findRecipeNode(html);
  if (!recipeNode) {
    return json({ error: "No recipe data found on that page." }, 422);
  }

  const recipe = mapRecipeNode(recipeNode);
  recipeCache.set(cacheKey, { expiresAt: Date.now() + DETAIL_CACHE_TTL_MS, value: recipe });
  return json(recipe);
}

/** Block localhost and private/link-local IP ranges to avoid SSRF. */
function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0") return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (/^169\.254\./.test(host)) return true;
  if (host === "[::1]" || host.startsWith("[fc") || host.startsWith("[fd") || host.startsWith("[fe80")) return true;
  return false;
}

type JsonLdNode = Record<string, unknown>;

function findRecipeNode(html: string): JsonLdNode | null {
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    let data: unknown;
    try {
      data = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const found = searchForRecipe(data);
    if (found) return found;
  }
  return null;
}

function searchForRecipe(data: unknown): JsonLdNode | null {
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = searchForRecipe(item);
      if (found) return found;
    }
    return null;
  }
  if (!data || typeof data !== "object") return null;
  const node = data as JsonLdNode;
  if (Array.isArray(node["@graph"])) {
    const found = searchForRecipe(node["@graph"]);
    if (found) return found;
  }
  const type = node["@type"];
  const isRecipe = type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"));
  return isRecipe ? node : null;
}

/** Parse the leading number out of strings like "12 g" or "250 calories". */
function parseLeadingNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const m = value.match(/[\d.]+/);
  return m ? Math.round(parseFloat(m[0])) : 0;
}

function mapRecipeNode(node: JsonLdNode): ImportedRecipe {
  const name = typeof node.name === "string" ? node.name.trim() : "Imported recipe";

  const rawIngredients = node.recipeIngredient ?? node.ingredients;
  const ingredients = Array.isArray(rawIngredients)
    ? rawIngredients.filter((i): i is string => typeof i === "string").map((i) => i.trim()).filter(Boolean)
    : [];

  const nutrition = (node.nutrition && typeof node.nutrition === "object" ? node.nutrition : {}) as JsonLdNode;

  const yieldRaw = Array.isArray(node.recipeYield) ? node.recipeYield[0] : node.recipeYield;
  const servings = typeof yieldRaw === "string" || typeof yieldRaw === "number" ? String(yieldRaw) : null;

  return {
    name,
    servings,
    calories: parseLeadingNumber(nutrition.calories),
    protein: parseLeadingNumber(nutrition.proteinContent),
    carbs: parseLeadingNumber(nutrition.carbohydrateContent),
    fat: parseLeadingNumber(nutrition.fatContent),
    ingredients,
  };
}

function json(data: unknown, status = 200, cacheSeconds?: number): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Let the browser's HTTP cache reuse successful lookups; errors stay uncached.
  if (cacheSeconds && status === 200) {
    headers["Cache-Control"] = `public, max-age=${Math.round(cacheSeconds)}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}
