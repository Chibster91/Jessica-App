import type { FdcFoodDetail, FdcFoodNutrient, FdcSearchResponse, FdcSearchResultFood } from "./fdc-types";

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const SEARCH_RESULT_LIMIT = 15;
const USDA_SEARCH_PAGE_SIZE = 50;
const UNIT_LABELS: Record<string, string> = {
  MLT: "ml",
  GRM: "g",
  G: "g",
  MG: "mg",
  MCG: "mcg",
  LBR: "lb",
  ONZ: "oz",
  OZA: "oz",
};

type DetailCacheEntry = {
  expiresAt: number;
  food: FdcFoodDetail;
};

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

type SearchRequest = {
  query: string;
  brandOwner?: string;
  brandedOnly?: boolean;
};

/** Shape returned by the worker's search endpoint (GET /). */
export type WorkerFood = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  ingredients: string | null;
  dataType: string | undefined;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  isSearchPreview?: boolean;
};

const detailCache = new Map<string, DetailCacheEntry>();
const barcodeCache = new Map<string, CacheEntry<BarcodeProduct>>();
const recipeCache = new Map<string, CacheEntry<ImportedRecipe>>();

const WORKER_USER_AGENT = "JessicaApp/1.0 (https://chibster91.github.io/Jessica-App/)";
// Recipe sites commonly reject non-browser agents, so mimic a real browser for those fetches.
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

type WorkerEnv = Env & { USDA_API_KEY?: unknown };

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
  const apiKey = getUsdaApiKey(env);
  if (!apiKey) {
    return missingUsdaApiKey();
  }

  let resultSets: FdcSearchResponse[];
  try {
    resultSets = await Promise.all(expandSearchRequests(query).map((request) => searchUsdaFoods(request, apiKey)));
  } catch (error) {
    if (isUsdaRequestError(error)) {
      return json(
        {
          error: error.message,
          status: error.status,
          detail: error.detail,
        },
        error.status
      );
    }

    throw error;
  }
  // Filter raw USDA results before any scoring or mapping
  const dataFoods = resultSets
    .flatMap((data: FdcSearchResponse) => data.foods ?? [])
    .filter((food: FdcSearchResultFood) => !isExperimentalFood(food));

  const seen = new Set<number | string>();

  const foods: WorkerFood[] = dataFoods
    .map((food: FdcSearchResultFood) => {
      return {
        id: food.fdcId,
        name: food.description,
        brand: food.brandOwner ?? null,
        category: food.foodCategory ?? null,
        ingredients: food.ingredients ?? null,
        dataType: food.dataType,
        servingSize: "Details required",
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        isSearchPreview: true,
      };
    })
    .filter((food: WorkerFood) => !isExperimentalFood(food))
    .sort((a: WorkerFood, b: WorkerFood) => rankSearchResult(b, query) - rankSearchResult(a, query))
    .filter((food: WorkerFood) => {
      const key = food.id || `${food.name}-${food.brand}-${food.calories}-${food.servingSize}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, SEARCH_RESULT_LIMIT);

  return json(foods);
}

async function searchUsdaFoods(request: SearchRequest, apiKey: string): Promise<FdcSearchResponse> {
  const searchUrl = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  searchUrl.searchParams.set("query", request.query);
  searchUrl.searchParams.set("pageSize", String(USDA_SEARCH_PAGE_SIZE));
  searchUrl.searchParams.set("api_key", apiKey);

  if (request.brandedOnly) {
    searchUrl.searchParams.set("dataType", "Branded");
  }

  if (request.brandOwner) {
    searchUrl.searchParams.set("brandOwner", request.brandOwner);
  }

  const r = await fetch(searchUrl.toString());
  if (!r.ok) {
    throw await toUsdaRequestError(r);
  }

  return r.json() as Promise<FdcSearchResponse>;
}

async function handleDetail(url: URL, env: WorkerEnv): Promise<Response> {
  const id = url.searchParams.get("id");
  if (!id) {
    return json({ error: "Missing required id query parameter." }, 400);
  }

  if (!/^\d+$/.test(id)) {
    return json({ error: "id must be a numeric FDC ID." }, 400);
  }

  const apiKey = getUsdaApiKey(env);
  if (!apiKey) {
    return missingUsdaApiKey();
  }

  let food: FdcFoodDetail;
  try {
    food = await fetchUsdaFoodDetail(id, apiKey);
  } catch (error) {
    if (isUsdaRequestError(error)) {
      return json(
        {
          error: error.message,
          status: error.status,
          detail: error.detail,
        },
        error.status
      );
    }

    throw error;
  }
  const servingSize = getServingSizeText(food) ?? getHouseholdServingText(food) ?? "100 g";

  return json({
    id: food.fdcId,
    name: food.description,
    brand: food.brandOwner ?? null,
    category: typeof food.foodCategory === "object" ? (food.foodCategory?.description ?? null) : (food.foodCategory ?? null),
    dataType: food.dataType,
    publicationDate: food.publicationDate || null,
    ingredients: food.ingredients || null,
    gtinUpc: food.gtinUpc || null,
    servingSize,
    servingSizeValue: food.servingSize || null,
    servingSizeUnit: normalizeServingUnit(food.servingSizeUnit),
    householdServingFullText: food.householdServingFullText || null,
    foodPortions: normalizeFoodPortions(food.foodPortions || []),
    labelNutrients: food.labelNutrients || null,
    nutrients: {
      calories: getCaloriesValue(food),
      protein: getProteinValue(food),
      carbs: getCarbsValue(food),
      fat: getFatValue(food),
      fiber: getFiberValue(food),
      sugars: getNutrientValue(food, [
        "Sugars, total including NLEA",
        "Total Sugars",
        "Sugars, total",
      ]),
      sodium: getSodiumValue(food),
    },
    foodNutrients: food.foodNutrients || [],
    isSearchPreview: false,
  });
}

async function fetchUsdaFoodDetail(id: string, apiKey: string): Promise<FdcFoodDetail> {
  const cached = detailCache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.food;
  }

  detailCache.delete(id);

  const detailUrl = new URL(`https://api.nal.usda.gov/fdc/v1/food/${id}`);
  detailUrl.searchParams.set("api_key", apiKey);

  const r = await fetch(detailUrl.toString());
  if (!r.ok) {
    throw await toUsdaRequestError(r);
  }

  const food = await r.json() as FdcFoodDetail;
  detailCache.set(id, {
    expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
    food,
  });

  return food;
}

type FoodWithNutrients = Pick<FdcFoodDetail, "servingSize" | "servingSizeUnit" | "labelNutrients" | "foodNutrients"> &
  Pick<FdcSearchResultFood, "foodNutrients"> & { dataType?: string; brand?: string | null };

function isHumanServingUnit(unit: unknown): boolean {
  if (typeof unit !== "string" || !unit.trim()) return false;
  const upper = unit.trim().toUpperCase();
  return upper !== "RACC" && upper !== "PORTION";
}

function getServingSizeText(food: Pick<FdcFoodDetail, "servingSize" | "servingSizeUnit">): string | null {
  const unit = normalizeServingUnit(food.servingSizeUnit);

  return food.servingSize && isHumanServingUnit(unit)
    ? `${food.servingSize} ${unit}`
    : null;
}

function getHouseholdServingText(food: Pick<FdcFoodDetail, "householdServingFullText">): string | null {
  return typeof food.householdServingFullText === "string" && food.householdServingFullText.trim()
    ? food.householdServingFullText.trim()
    : null;
}

function normalizeServingUnit(unit: unknown): string | null {
  if (typeof unit !== "string" || !unit.trim()) return null;

  const trimmedUnit = unit.trim();
  return UNIT_LABELS[trimmedUnit.toUpperCase()] ?? trimmedUnit.toLowerCase();
}

function normalizeFoodPortions(portions: FdcFoodDetail["foodPortions"]): FdcFoodDetail["foodPortions"] {
  return (portions ?? []).map((portion) => ({
    ...portion,
    measureUnit: portion.measureUnit
      ? {
          ...portion.measureUnit,
          name: normalizeServingUnit(portion.measureUnit.name) ?? portion.measureUnit.name,
          abbreviation:
            normalizeServingUnit(portion.measureUnit.abbreviation) ?? portion.measureUnit.abbreviation,
        }
      : portion.measureUnit,
  }));
}

const ENERGY_NAMES = [
  "Energy",
  "Energy (Atwater General Factors)",
  "Energy (Atwater Specific Factors)",
];

function getCaloriesValue(food: FoodWithNutrients): number {
  if (isBrandedFoodData(food)) {
    const labelCalories = getLabelCaloriesValue(food);
    if (labelCalories !== null) return labelCalories;
  }

  return Math.round(getNutrientValue(food, ENERGY_NAMES, "KCAL"));
}

function getLabelCaloriesValue(food: FoodWithNutrients): number | null {
  const labelCalories = getLabelNutrientValue(food, "calories");
  return labelCalories !== null ? Math.round(labelCalories) : null;
}

function getProteinValue(food: FoodWithNutrients): number {
  return getPreferredNutrientValue(food, "protein", "Protein");
}

function getCarbsValue(food: FoodWithNutrients): number {
  return getPreferredNutrientValue(food, "carbohydrates", "Carbohydrate, by difference");
}

function getFatValue(food: FoodWithNutrients): number {
  return getPreferredNutrientValue(food, "fat", "Total lipid (fat)");
}

function getFiberValue(food: FoodWithNutrients): number {
  return getPreferredNutrientValue(food, "fiber", "Fiber, total dietary");
}

function getSodiumValue(food: FoodWithNutrients): number {
  return getPreferredNutrientValue(food, "sodium", "Sodium, Na");
}

function isBrandedFoodData(food: FoodWithNutrients): boolean {
  return normalizeSearchForMatching(food.dataType) === "branded" || Boolean(food.labelNutrients);
}

function getPreferredNutrientValue(
  food: FoodWithNutrients,
  labelKey: keyof NonNullable<FdcFoodDetail["labelNutrients"]>,
  nutrientName: string | string[]
): number {
  return isBrandedFoodData(food)
    ? getLabelNutrientValue(food, labelKey) ?? getNutrientValue(food, nutrientName)
    : getNutrientValue(food, nutrientName);
}

function getLabelNutrientValue(food: FoodWithNutrients, key: keyof NonNullable<FdcFoodDetail["labelNutrients"]>): number | null {
  const value = food.labelNutrients?.[key]?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNutrientValue(food: FoodWithNutrients, name: string | string[], unit?: string): number {
  const names = Array.isArray(name) ? name : [name];
  const nutrients = food.foodNutrients as Array<FdcFoodNutrient & { nutrientName?: string; value?: number; unitName?: string }> | undefined;
  const nutrient = nutrients?.find((n) => {
    const nutrientName = n.nutrientName ?? n.nutrient?.name;
    const unitName = n.unitName ?? n.nutrient?.unitName;
    return names.includes(nutrientName ?? "") && (!unit || unitName?.toUpperCase() === unit);
  });

  return nutrient?.value ?? nutrient?.amount ?? 0;
}

function expandSearchRequests(query: string): SearchRequest[] {
  const normalizedQuery = normalizeSearchText(query);
  const queryWithoutPunctuation = normalizeSearchForMatching(query);
  const brandMatch = getKnownBrandMatch(normalizedQuery);
  const requests: SearchRequest[] = [
    { query },
    { query, brandedOnly: true },
  ];

  if (brandMatch) {
    const productQuery = normalizeSearchForMatching(normalizedQuery.slice(brandMatch.key.length)).trim();
    const productQueryWithCategory = addLikelyProductCategory(productQuery);

    if (productQuery) {
      requests.push(
        { query: productQuery, brandOwner: brandMatch.brandOwner, brandedOnly: true },
        { query: productQueryWithCategory, brandOwner: brandMatch.brandOwner, brandedOnly: true }
      );
    }
  }

  const categoryQuery = addLikelyProductCategory(queryWithoutPunctuation);
  if (categoryQuery !== queryWithoutPunctuation) {
    requests.push({ query: categoryQuery, brandedOnly: true });
  }

  return dedupeSearchRequests(requests.filter((request) => request.query.trim()));
}

function getKnownBrandMatch(queryText: string): { key: string; brandOwner: string } | null {
  const knownBrands = [
    { key: "international delight", brandOwner: "International Delight" },
    { key: "coffee mate", brandOwner: "Coffee Mate" },
    { key: "coffeemate", brandOwner: "Coffee Mate" },
    { key: "chobani", brandOwner: "Chobani" },
    { key: "dannon", brandOwner: "Dannon" },
    { key: "yoplait", brandOwner: "Yoplait" },
    { key: "oikos", brandOwner: "Oikos" },
    { key: "fairlife", brandOwner: "Fairlife" },
    { key: "quest", brandOwner: "Quest" },
    { key: "kellogg", brandOwner: "Kellogg" },
    { key: "kelloggs", brandOwner: "Kellogg" },
    { key: "general mills", brandOwner: "General Mills" },
    { key: "great value", brandOwner: "Great Value" },
    { key: "market pantry", brandOwner: "Market Pantry" },
    { key: "good and gather", brandOwner: "Good & Gather" },
  ];

  return knownBrands.find((brand) => queryText.startsWith(brand.key)) ?? null;
}

function addLikelyProductCategory(queryText: string): string {
  if (
    /\b(international delight|coffee mate|coffeemate|creamer|creamers)\b/.test(queryText) &&
    !/\bcoffee creamer\b/.test(queryText)
  ) {
    return `${queryText} coffee creamer`;
  }

  return queryText;
}

function dedupeSearchRequests(requests: SearchRequest[]): SearchRequest[] {
  const seen = new Set<string>();

  return requests.filter((request) => {
    const key = [
      normalizeSearchForMatching(request.query),
      normalizeSearchForMatching(request.brandOwner || ""),
      request.brandedOnly ? "branded" : "all",
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankSearchResult(food: WorkerFood, query: string): number {
  const queryText = normalizeSearchForMatching(query);
  const queryWords = getSearchWords(queryText);
  const name = normalizeSearchForMatching(food.name);
  const brand = normalizeSearchForMatching(food.brand ?? "");
  const category = normalizeSearchForMatching(food.category ?? "");
  const searchableText = `${name} ${brand} ${category}`.trim();
  const dataType = normalizeSearchForMatching(food.dataType);
  const matchedNameWords = queryWords.filter((word) => hasSearchWord(name, word));
  const matchedWords = queryWords.filter((word) => hasSearchWord(searchableText, word));
  let score = 0;

  // Foundation/SR descriptions are authoritative — boost when all query words appear in the name itself.
  if ((dataType === "foundation" || dataType === "sr legacy") && matchedNameWords.length === queryWords.length && queryWords.length > 0) {
    score += 30;
  }

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

function isExperimentalFood(food: FdcSearchResultFood | WorkerFood): boolean {
  const candidates = [
    food.dataType,
    (food as FdcSearchResultFood).foodCategory,
    (food as WorkerFood).category,
  ];
  return candidates.some((v) => {
    const t = normalizeSearchText(v ?? "");
    return t.includes("experimental") || t.includes("survey");
  });
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

function getUsdaApiKey(env: WorkerEnv): string | null {
  return typeof env.USDA_API_KEY === "string" && env.USDA_API_KEY
    ? env.USDA_API_KEY
    : null;
}

function missingUsdaApiKey(): Response {
  return json({ error: "USDA_API_KEY is not configured." }, 500);
}

async function toUsdaRequestError(response: Response): Promise<Error & { status: number; detail: string }> {
  const error = new Error("USDA request failed.") as Error & { status: number; detail: string };
  error.status = response.status;
  error.detail = await response.text();

  return error;
}

function isUsdaRequestError(error: unknown): error is Error & { status: number; detail: string } {
  return (
    error instanceof Error &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { detail?: unknown }).detail === "string"
  );
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
