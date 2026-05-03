import type { FdcFoodDetail, FdcFoodNutrient, FdcSearchResponse, FdcSearchResultFood } from "./fdc-types";

const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const SEARCH_DETAIL_ENRICH_LIMIT = 8;
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
};

const detailCache = new Map<string, DetailCacheEntry>();

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/detail") {
      return handleDetail(url, env);
    }

    const query = url.searchParams.get("query") || "egg";
    const apiKey = getUsdaApiKey(env);
    if (!apiKey) {
      return missingUsdaApiKey();
    }

    let resultSets: any[];
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
          servingSize: "100 g",
          calories: getCaloriesValue(food),
          protein: Math.max(0, getProteinValue(food)),
          carbs: Math.max(0, getCarbsValue(food)),
          fat: Math.max(0, getFatValue(food)),
        };
      })
      // Defensive: exclude experimental entries and zero-calorie records that slipped through
      .filter((food: WorkerFood) => !isExperimentalFood(food) && food.calories > 0)
      .sort((a: WorkerFood, b: WorkerFood) => rankSearchResult(b, query) - rankSearchResult(a, query))
      .filter((food: WorkerFood) => {
        const key = food.id || `${food.name}-${food.brand}-${food.calories}-${food.servingSize}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, SEARCH_RESULT_LIMIT);

    return json(await enrichBrandedSearchResults(foods, apiKey));
  },
};

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

async function handleDetail(url: URL, env: any): Promise<Response> {
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
  const servingSize = getServingSizeText(food);

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
  });
}

async function enrichBrandedSearchResults(foods: WorkerFood[], apiKey: string): Promise<WorkerFood[]> {
  let enrichedCount = 0;

  return Promise.all(
    foods.map(async (food) => {
      if (!isPackagedFood(food) || enrichedCount >= SEARCH_DETAIL_ENRICH_LIMIT) {
        return food;
      }

      enrichedCount += 1;

      try {
        const detail = await fetchUsdaFoodDetail(String(food.id), apiKey);
        const labelCalories = getLabelCaloriesValue(detail);

        if (labelCalories === null) {
          return food;
        }

        return {
          ...food,
          servingSize: getServingSizeText(detail) ?? food.servingSize,
          calories: labelCalories,
          protein: getProteinValue(detail),
          carbs: getCarbsValue(detail),
          fat: getFatValue(detail),
          fiber: getFiberValue(detail),
          sodium: getSodiumValue(detail),
        };
      } catch {
        return food;
      }
    })
  );
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

function isPackagedFood(food: WorkerFood): boolean {
  return normalizeSearchText(food.dataType ?? "") === "branded" || Boolean(food.brand);
}

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
  const labelCalories = getLabelCaloriesValue(food);
  if (labelCalories !== null) return labelCalories;

  const kcal = getNutrientValue(food, ENERGY_NAMES, "KCAL");
  if (kcal > 0) return Math.round(kcal);

  // Foundation/SR Legacy foods sometimes omit energy from truncated search results —
  // estimate from macros using Atwater general factors as a fallback.
  const protein = Math.max(0, getProteinValue(food));
  const carbs = Math.max(0, getCarbsValue(food));
  const fat = Math.max(0, getFatValue(food));
  if (protein > 0 || carbs > 0 || fat > 0) {
    return Math.round(protein * 4 + carbs * 4 + fat * 9);
  }

  return 0;
}

function getLabelCaloriesValue(food: FoodWithNutrients): number | null {
  const labelCalories = getLabelNutrientValue(food, "calories");
  return labelCalories !== null ? Math.round(labelCalories) : null;
}

function getProteinValue(food: FoodWithNutrients): number {
  return getLabelNutrientValue(food, "protein") ?? getNutrientValue(food, "Protein");
}

function getCarbsValue(food: FoodWithNutrients): number {
  return getLabelNutrientValue(food, "carbohydrates") ?? getNutrientValue(food, "Carbohydrate, by difference");
}

function getFatValue(food: FoodWithNutrients): number {
  return getLabelNutrientValue(food, "fat") ?? getNutrientValue(food, "Total lipid (fat)");
}

function getFiberValue(food: FoodWithNutrients): number {
  return getLabelNutrientValue(food, "fiber") ?? getNutrientValue(food, "Fiber, total dietary");
}

function getSodiumValue(food: FoodWithNutrients): number {
  return getLabelNutrientValue(food, "sodium") ?? getNutrientValue(food, "Sodium, Na");
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

function getUsdaApiKey(env: any): string | null {
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
