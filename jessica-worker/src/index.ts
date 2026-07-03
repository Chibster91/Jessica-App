import type { FdcFoodDetail, FdcFoodNutrient, FdcSearchResponse, FdcSearchResultFood } from "./fdc-types";
import { searchBrandedD1, getFoodDetailD1, type D1SearchResult } from "./d1Search";

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const SEARCH_CACHE_TTL_MS = 1000 * 60 * 60;
const SEARCH_CACHE_MAX_ENTRIES = 500;
// Total merged-result cap, and the slots guaranteed to each tier before leftovers are shared.
const SEARCH_RESULT_LIMIT = 25;
const SEARCH_TIER_MIN = 10;
const USDA_SEARCH_PAGE_SIZE = 50;
// Tier 1 = USDA's quality ladder (lab-analyzed → curated → survey); Tier 2 = Branded.
// Survey (FNDDS) is requested separately: USDA returns HTTP 400 (not an empty list) when a query
// has no Survey matches, so bundling it with Foundation/SR Legacy would take those down too.
// Promise.allSettled below keeps that 400 harmless.
const TIER1_CORE_DATA_TYPES = "Foundation,SR Legacy";
const TIER1_SURVEY_DATA_TYPE = "Survey (FNDDS)";
const TIER2_DATA_TYPES = "Branded";
// D1-first branded tier: when the canonical D1 database returns at least this
// many results, the live USDA Branded requests are skipped entirely.
const D1_TIER2_MIN_RESULTS = 5;
// Canonical D1 entries are the deduped/cleaned copies — nudge them above raw
// live duplicates of the same product when both appear in a fallback merge.
const D1_CANONICAL_BONUS = 20;
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
  tier: number;
  dataType?: string;
  brandOwner?: string;
  requireAllWords?: boolean;
};

/** Result of one settled USDA request — keeps the tier so failed requests don't break index alignment. */
type SettledSearch =
  | { ok: true; tier: number; response: FdcSearchResponse }
  | { ok: false; error: unknown };

/** Shape returned by the worker's search endpoint (GET /). */
export type WorkerFood = {
  id: number;
  name: string;
  brand: string | null;
  brandName: string | null;
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
  /** True for canonical entries served from D1 (deduped offline pipeline). */
  canonical?: boolean;
  /** True when the query matched this food's brand in the D1 brands table. */
  brandMatch?: boolean;
};

const detailCache = new Map<string, DetailCacheEntry>();
const searchCache = new Map<string, CacheEntry<WorkerFood[]>>();
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
  const liveUsdaEnabled = url.searchParams.get("liveUsda") !== "0";
  const apiKey = liveUsdaEnabled ? getUsdaApiKey(env) : null;
  if (liveUsdaEnabled && !apiKey) {
    return missingUsdaApiKey();
  }

  const searchCacheKey = `${liveUsdaEnabled ? "live" : "d1"}:${normalizeSearchForMatching(query)}`;
  const cachedSearch = searchCache.get(searchCacheKey);
  if (cachedSearch && cachedSearch.expiresAt > Date.now()) {
    return json(cachedSearch.value, 200, SEARCH_CACHE_TTL_MS / 1000);
  }
  searchCache.delete(searchCacheKey);

  // D1-first branded tier: the canonical database answers in parallel with the
  // live Tier-1 requests; live Branded requests only fire when D1 comes up
  // short (or errors), so common packaged foods never hit USDA's raw listings.
  const d1Promise: Promise<D1SearchResult | null> = env.FOODS_DB
    ? searchBrandedD1(env.FOODS_DB, query).catch((error) => {
        console.error("D1 branded search failed; falling back to live USDA", error);
        return null;
      })
    : Promise.resolve(null);

  const allRequests = expandSearchRequests(query);
  const tier1Requests = allRequests.filter((request) => request.tier === 1);
  const tier2Requests = allRequests.filter((request) => request.tier === 2);

  const [d1Result, tier1Settled] = await Promise.all([
    d1Promise,
    liveUsdaEnabled && apiKey ? runSearchRequests(tier1Requests, apiKey) : Promise.resolve([]),
  ]);
  const d1Foods = d1Result?.foods ?? [];
  const useLiveTier2 = liveUsdaEnabled && d1Foods.length < D1_TIER2_MIN_RESULTS;
  const settled = useLiveTier2
    ? tier1Settled.concat(await runSearchRequests(tier2Requests, apiKey as string))
    : tier1Settled;

  const fulfilled = settled.filter((r): r is Extract<SettledSearch, { ok: true }> => r.ok);
  if (fulfilled.length === 0 && d1Foods.length === 0) {
    const error = (settled.find((r) => !r.ok) as Extract<SettledSearch, { ok: false }> | undefined)?.error;
    if (isUsdaRequestError(error)) {
      return json({ error: error.message, status: error.status, detail: error.detail }, error.status);
    }
    if (liveUsdaEnabled) throw error;
  }

  let tagged = collectTaggedFoods(fulfilled);

  // Strict retrieval found nothing (typo, plural, stray adjective) — one relaxed retry
  // without requireAllWords. Only runs when the strict pass succeeded but came back empty,
  // so strict results always win when they exist. D1 hits count as results.
  if (liveUsdaEnabled && apiKey && tagged.length === 0 && d1Foods.length === 0) {
    const loose = await runSearchRequests(looseSearchRequests(query), apiKey);
    tagged = collectTaggedFoods(loose.filter((r): r is Extract<SettledSearch, { ok: true }> => r.ok));
  }

  const nutritionQualityById = new Map<number, number>(
    tagged.map(({ food }) => [food.fdcId, nutritionQualityScore(food)])
  );

  // Map to WorkerFood, dedup by fdcId, score within tier. D1 canonicals go in
  // first so a raw live copy of the same fdcId is skipped by `seen`, and get a
  // flat bonus so live near-duplicates of the same product rank below them.
  const seen = new Set<number | string>();
  const ranked: RankedWorkerFood[] = [];
  for (const { food, quality } of d1Foods) {
    if (seen.has(food.id)) continue;
    seen.add(food.id);
    ranked.push({
      food,
      tier: 2,
      score: rankSearchResult(food, query) + Math.min(quality, 15) * 2 + D1_CANONICAL_BONUS,
    });
  }
  for (const { food: raw, tier } of tagged) {
    const preview = buildPreviewNutrition(raw);
    const food: WorkerFood = {
      id: raw.fdcId,
      name: raw.description,
      brand: raw.brandOwner ?? null,
      brandName: raw.brandName ?? null,
      // Branded foods carry their category in brandedFoodCategory; foundation/SR use foodCategory.
      category: raw.brandedFoodCategory ?? raw.foodCategory ?? null,
      ingredients: raw.ingredients ?? null,
      dataType: raw.dataType,
      servingSize: preview.servingSize,
      calories: preview.calories,
      protein: preview.protein,
      carbs: preview.carbs,
      fat: preview.fat,
      fiber: preview.fiber,
      sodium: preview.sodium,
      isSearchPreview: true,
    };
    if (isExperimentalFood(food)) continue;
    const key = food.id || `${food.name}-${food.brand}-${food.calories}-${food.servingSize}`;
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push({
      food,
      tier,
      score: rankSearchResult(food, query) + (nutritionQualityById.get(food.id) ?? 0),
    });
  }

  // Tier-aware cap: Tier 1 (quality) ranked above Tier 2 (branded), but both tiers are
  // guaranteed slots so neither starves the other before the client re-ranks — leaving room
  // for client scoring to promote a strong branded brand-intent match above weak Tier 1 noise.
  const tier1 = dedupeTierByNameAndBrand(ranked.filter((r) => r.tier === 1));
  const tier2 = dedupeTierByNameAndBrand(ranked.filter((r) => r.tier === 2));
  const foods: WorkerFood[] = applyTierCap(tier1, tier2).map((r) => r.food);

  if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(searchCacheKey, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value: foods });

  return json(foods, 200, SEARCH_CACHE_TTL_MS / 1000);
}

type RankedWorkerFood = { food: WorkerFood; tier: number; score: number };

/** Settle each request independently so one failure (e.g. USDA's 400 for a dataType with no
 * matches) can't sink the whole search; callers surface an error only if every request failed. */
function runSearchRequests(requests: SearchRequest[], apiKey: string): Promise<SettledSearch[]> {
  return Promise.all(
    requests.map((request) =>
      searchUsdaFoods(request, apiKey).then(
        (response): SettledSearch => ({ ok: true, tier: request.tier, response }),
        (error): SettledSearch => ({ ok: false, error })
      )
    )
  );
}

/** Tag each raw result with the tier of the request that produced it; drop experimental foods
 * and records with no calorie data at all (useless to a tracker — they'd show as "0 cal"). */
function collectTaggedFoods(
  fulfilled: Extract<SettledSearch, { ok: true }>[]
): { food: FdcSearchResultFood; tier: number }[] {
  return fulfilled.flatMap((r) =>
    (r.response.foods ?? [])
      .filter((food: FdcSearchResultFood) => !isExperimentalFood(food) && hasEnergyData(food))
      .map((food: FdcSearchResultFood) => ({ food, tier: r.tier }))
  );
}

/** Fallback requests for the relaxed retry: just the base tiers, no requireAllWords. */
function looseSearchRequests(query: string): SearchRequest[] {
  return [
    { query, tier: 1, dataType: TIER1_CORE_DATA_TYPES },
    { query, tier: 1, dataType: TIER1_SURVEY_DATA_TYPE },
    { query, tier: 2, dataType: TIER2_DATA_TYPES },
  ];
}

type PreviewNutrition = {
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
};

/** Build list-preview nutrition from the search response itself, so results show calories
 * without a detail round-trip. Search nutrients are per 100 g/ml; Branded results also carry
 * the label serving size, so scale to per-serving when that serving is a plain weight/volume.
 * Values are estimates for at-a-glance comparison — tapping a result still fetches full detail. */
function buildPreviewNutrition(raw: FdcSearchResultFood): PreviewNutrition {
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const per100: PreviewNutrition = {
    servingSize: "100 g",
    calories: Math.round(getNutrientValue(raw, ENERGY_NAMES, "KCAL")),
    protein: round1(getNutrientValue(raw, "Protein")),
    carbs: round1(getNutrientValue(raw, "Carbohydrate, by difference")),
    fat: round1(getNutrientValue(raw, "Total lipid (fat)")),
    fiber: round1(getNutrientValue(raw, "Fiber, total dietary")),
    sodium: Math.round(getNutrientValue(raw, "Sodium, Na")),
  };

  const unit = normalizeServingUnit(raw.servingSizeUnit);
  const amount = typeof raw.servingSize === "number" && Number.isFinite(raw.servingSize) && raw.servingSize > 0
    ? raw.servingSize
    : null;
  if (!amount || (unit !== "g" && unit !== "ml")) return per100;

  const factor = amount / 100;
  return {
    servingSize: `${Number(amount.toFixed(1))} ${unit}`,
    calories: Math.round(per100.calories * factor),
    protein: round1(per100.protein * factor),
    carbs: round1(per100.carbs * factor),
    fat: round1(per100.fat * factor),
    fiber: round1(per100.fiber * factor),
    sodium: Math.round(per100.sodium * factor),
  };
}

const DATA_TYPE_DEDUP_PRIORITY: Record<string, number> = {
  foundation: 3,
  "sr legacy": 2,
  "survey (fndds)": 1,
};

/** Dedup key for a food name: drop comma segments that only repeat words from the
 * leading segment ("HAZELNUT SPREAD WITH COCOA, COCOA" → "hazelnut spread with cocoa"),
 * so USDA's stutter-named duplicates of one product collapse to a single key. */
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

/** Collapse near-duplicate records — the same food name under the same brand — keeping the
 * best-scored copy (score already includes nutrition-data quality). On a tie, prefer USDA's
 * higher-quality dataset (Foundation over SR Legacy over Survey). Runs within a tier so a
 * Branded product can never absorb a whole food that shares its name. */
function dedupeTierByNameAndBrand(entries: RankedWorkerFood[]): RankedWorkerFood[] {
  const byKey = new Map<string, RankedWorkerFood>();
  for (const entry of entries) {
    const brandKey = normalizeSearchForMatching(entry.food.brandName ?? entry.food.brand ?? "");
    const key = `${nameDedupKey(entry.food.name)}|${brandKey}`;
    const existing = byKey.get(key);
    if (
      !existing ||
      entry.score > existing.score ||
      (entry.score === existing.score &&
        (DATA_TYPE_DEDUP_PRIORITY[normalizeSearchForMatching(entry.food.dataType)] ?? 0) >
          (DATA_TYPE_DEDUP_PRIORITY[normalizeSearchForMatching(existing.food.dataType)] ?? 0))
    ) {
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

async function searchUsdaFoods(request: SearchRequest, apiKey: string): Promise<FdcSearchResponse> {
  const searchUrl = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  searchUrl.searchParams.set("query", request.query);
  searchUrl.searchParams.set("pageSize", String(USDA_SEARCH_PAGE_SIZE));
  searchUrl.searchParams.set("api_key", apiKey);

  if (request.dataType) {
    searchUrl.searchParams.set("dataType", request.dataType);
  }

  if (request.requireAllWords) {
    searchUrl.searchParams.set("requireAllWords", "true");
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

/** Cap merged results while guaranteeing each tier a minimum number of slots, so a flood of
 * one tier can't crowd the other out before the client re-ranks. Leftover slots after the
 * per-tier minimums go to whichever tier still has candidates (Tier 1 first). */
function applyTierCap<T>(tier1: T[], tier2: T[]): T[] {
  let take1 = Math.min(tier1.length, SEARCH_TIER_MIN);
  let take2 = Math.min(tier2.length, SEARCH_TIER_MIN);
  let remaining = SEARCH_RESULT_LIMIT - take1 - take2;

  if (remaining > 0) {
    const add1 = Math.min(remaining, tier1.length - take1);
    take1 += add1;
    remaining -= add1;
  }
  if (remaining > 0) {
    take2 += Math.min(remaining, tier2.length - take2);
  }

  return [...tier1.slice(0, take1), ...tier2.slice(0, take2)];
}

async function handleDetail(url: URL, env: WorkerEnv): Promise<Response> {
  const id = url.searchParams.get("id");
  if (!id) {
    return json({ error: "Missing required id query parameter." }, 400);
  }

  if (!/^\d+$/.test(id)) {
    return json({ error: "id must be a numeric FDC ID." }, 400);
  }

  // D1-first: canonical foods carry their own detail (per-serving nutrition +
  // package-size portions). A miss falls through to live USDA — canonical ids
  // are real FDC ids, so the fallback always resolves.
  if (env.FOODS_DB) {
    try {
      const canonicalDetail = await getFoodDetailD1(env.FOODS_DB, Number(id));
      if (canonicalDetail) {
        return json(canonicalDetail, 200, DETAIL_CACHE_TTL_MS / 1000);
      }
    } catch (error) {
      console.error("D1 detail lookup failed; falling back to live USDA", error);
    }
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
  }, 200, DETAIL_CACHE_TTL_MS / 1000);
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
    // Tier 1 — quality whole foods, strict word matching to cut partial-match noise.
    // Survey is its own request so its empty-query 400 can't sink Foundation/SR Legacy.
    { query, tier: 1, dataType: TIER1_CORE_DATA_TYPES, requireAllWords: true },
    { query, tier: 1, dataType: TIER1_SURVEY_DATA_TYPE, requireAllWords: true },
    // Tier 2 — branded/packaged products, also strict.
    { query, tier: 2, dataType: TIER2_DATA_TYPES, requireAllWords: true },
  ];

  if (brandMatch) {
    const productQuery = normalizeSearchForMatching(normalizedQuery.slice(brandMatch.key.length)).trim();
    const productQueryWithCategory = addLikelyProductCategory(productQuery);

    if (productQuery) {
      requests.push(
        { query: productQuery, tier: 2, dataType: TIER2_DATA_TYPES, brandOwner: brandMatch.brandOwner, requireAllWords: true },
        { query: productQueryWithCategory, tier: 2, dataType: TIER2_DATA_TYPES, brandOwner: brandMatch.brandOwner, requireAllWords: true }
      );
    }
  }

  const categoryQuery = addLikelyProductCategory(queryWithoutPunctuation);
  if (categoryQuery !== queryWithoutPunctuation) {
    requests.push({ query: categoryQuery, tier: 2, dataType: TIER2_DATA_TYPES, requireAllWords: true });
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
      request.dataType || "all",
      request.requireAllWords ? "strict" : "loose",
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

/** Count nutrients on a search result that carry a real positive value. USDA's
 * branded set holds many duplicate records per product; the complete ones list
 * far more populated nutrients than the sparse/empty duplicates. */
function countPopulatedSearchNutrients(food: FdcSearchResultFood): number {
  return (food.foodNutrients ?? []).reduce((count, n) => {
    const value = n.value ?? n.amount;
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? count + 1 : count;
  }, 0);
}

/** Whether a search result carries an energy nutrient at all (a 0-kcal value
 * still counts — diet drinks are legitimately zero). Records missing it
 * entirely have no usable calorie data for a tracker. */
function hasEnergyData(food: FdcSearchResultFood): boolean {
  return (food.foodNutrients ?? []).some((n) => {
    const value = n.value ?? n.amount;
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    const name = (n.nutrientName ?? n.name ?? "").toLowerCase();
    return n.nutrientNumber === "208" || n.nutrientId === 1008 || n.nutrientId === 2047 || n.nutrientId === 2048 || name.includes("energy");
  });
}

/** Ranking adjustment that rewards nutritionally complete records, so the trustworthy
 * duplicate surfaces first. (Records with no calorie data at all never reach ranking —
 * collectTaggedFoods drops them outright.) */
function nutritionQualityScore(food: FdcSearchResultFood): number {
  return Math.min(countPopulatedSearchNutrients(food), 15) * 2;
}

function isExperimentalFood(food: FdcSearchResultFood | WorkerFood): boolean {
  const candidates = [
    food.dataType,
    (food as FdcSearchResultFood).foodCategory,
    (food as WorkerFood).category,
  ];
  return candidates.some((v) => {
    const t = normalizeSearchText(v ?? "");
    // Survey (FNDDS) is now a Tier 1 data type, so it is no longer stripped here;
    // only true "Experimental" lab foods are excluded.
    return t.includes("experimental");
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

function json(data: unknown, status = 200, cacheSeconds?: number): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  // Let the browser's HTTP cache reuse successful lookups; errors stay uncached.
  if (cacheSeconds && status === 200) {
    headers["Cache-Control"] = `public, max-age=${Math.round(cacheSeconds)}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}
