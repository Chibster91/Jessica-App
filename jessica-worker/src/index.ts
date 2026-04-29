const DETAIL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const SEARCH_DETAIL_ENRICH_LIMIT = 8;

type DetailCacheEntry = {
  expiresAt: number;
  food: any;
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

    const searchUrl = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
    searchUrl.searchParams.set("query", query);
    searchUrl.searchParams.set("pageSize", "25");
    searchUrl.searchParams.set("api_key", apiKey);

    const r = await fetch(searchUrl.toString());
    if (!r.ok) {
      return usdaError(r);
    }

    const data: any = await r.json();
    const seen = new Set();

    const foods = (data.foods || [])
      .map((food: any) => {
        const servingSize =
          food.servingSize && food.servingSizeUnit
            ? `${food.servingSize} ${food.servingSizeUnit}`
            : "100 g";

        return {
          id: food.fdcId,
          name: food.description,
          brand: food.brandName || food.brandOwner || null,
          category: food.foodCategory || null,
          ingredients: food.ingredients || null,
          dataType: food.dataType,
          servingSize,
          calories: getCaloriesValue(food),
          protein: getNutrientValue(food, "Protein"),
          carbs: getNutrientValue(food, "Carbohydrate, by difference"),
          fat: getNutrientValue(food, "Total lipid (fat)"),
        };
      })
      .sort((a: any, b: any) => rankSearchResult(b, query) - rankSearchResult(a, query))
      .filter((food: any) => {
        const key = `${food.name}-${food.brand}-${food.calories}-${food.servingSize}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 15);

    return json(await enrichBrandedSearchResults(foods, apiKey));
  },
};

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

  let food: any;
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
  const servingSize =
    food.servingSize && food.servingSizeUnit
      ? `${food.servingSize} ${food.servingSizeUnit}`
      : null;

  return json({
    id: food.fdcId,
    name: food.description,
    brand: food.brandName || food.brandOwner || null,
    category: food.foodCategory?.description || food.foodCategory || null,
    dataType: food.dataType,
    publicationDate: food.publicationDate || null,
    ingredients: food.ingredients || null,
    gtinUpc: food.gtinUpc || null,
    servingSize,
    servingSizeValue: food.servingSize || null,
    servingSizeUnit: food.servingSizeUnit || null,
    householdServingFullText: food.householdServingFullText || null,
    foodPortions: food.foodPortions || [],
    labelNutrients: food.labelNutrients || null,
    nutrients: {
      calories: getCaloriesValue(food),
      protein: getNutrientValue(food, "Protein"),
      carbs: getNutrientValue(food, "Carbohydrate, by difference"),
      fat: getNutrientValue(food, "Total lipid (fat)"),
      fiber: getNutrientValue(food, "Fiber, total dietary"),
      sugars: getNutrientValue(food, [
        "Sugars, total including NLEA",
        "Total Sugars",
        "Sugars, total",
      ]),
      sodium: getNutrientValue(food, "Sodium, Na"),
    },
    foodNutrients: food.foodNutrients || [],
  });
}

async function enrichBrandedSearchResults(foods: any[], apiKey: string): Promise<any[]> {
  let enrichedCount = 0;

  const enrichedFoods = await Promise.all(
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
        };
      } catch {
        return food;
      }
    })
  );

  return enrichedFoods;
}

async function fetchUsdaFoodDetail(id: string, apiKey: string): Promise<any> {
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

  const food: any = await r.json();
  detailCache.set(id, {
    expiresAt: Date.now() + DETAIL_CACHE_TTL_MS,
    food,
  });

  return food;
}

function isPackagedFood(food: any): boolean {
  return normalizeSearchText(food.dataType) === "branded" || Boolean(food.brand);
}

function getServingSizeText(food: any): string | null {
  return food.servingSize && food.servingSizeUnit
    ? `${food.servingSize} ${food.servingSizeUnit}`
    : null;
}

function getCaloriesValue(food: any): number {
  const labelCalories = getLabelCaloriesValue(food);
  if (labelCalories !== null) return labelCalories;

  return getNutrientValue(food, "Energy", "KCAL");
}

function getLabelCaloriesValue(food: any): number | null {
  const labelCalories = food.labelNutrients?.calories?.value;
  return typeof labelCalories === "number" && Number.isFinite(labelCalories)
    ? Math.round(labelCalories)
    : null;
}

function getNutrientValue(food: any, name: string | string[], unit?: string): number {
  const names = Array.isArray(name) ? name : [name];
  const nutrient = food.foodNutrients?.find((n: any) => {
    const nutrientName = n.nutrientName || n.nutrient?.name;
    const unitName = n.unitName || n.nutrient?.unitName;

    return names.includes(nutrientName) && (!unit || unitName?.toUpperCase() === unit);
  });

  return nutrient?.value ?? nutrient?.amount ?? 0;
}

function rankSearchResult(food: any, query: string): number {
  const queryText = normalizeSearchText(query);
  const name = normalizeSearchText(food.name);
  const dataType = normalizeSearchText(food.dataType);
  let score = 0;

  if (dataType === "foundation" || dataType === "sr legacy" || dataType.includes("survey")) {
    score += 40;
  } else if (dataType === "branded") {
    score -= 30;
  }

  if (isBasicSearchQuery(queryText) && /\b(raw|cooked|plain)\b/.test(name)) {
    score += 15;
  }

  for (const term of ["juice", "candied", "drink", "sauce", "pie", "snack", "candy", "mix"]) {
    if (hasSearchWord(name, term) && !hasSearchWord(queryText, term)) {
      score -= 25;
    }
  }

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

function getUsdaApiKey(env: any): string | null {
  return typeof env.USDA_API_KEY === "string" && env.USDA_API_KEY
    ? env.USDA_API_KEY
    : null;
}

function missingUsdaApiKey(): Response {
  return json({ error: "USDA_API_KEY is not configured." }, 500);
}

async function usdaError(response: Response): Promise<Response> {
  const error = await toUsdaRequestError(response);

  return json(
    {
      error: error.message,
      status: error.status,
      detail: error.detail,
    },
    response.status
  );
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
