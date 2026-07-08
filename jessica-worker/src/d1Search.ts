// D1-backed food search — the only search path, no live external API. The
// `foods` table holds one clean entry per real-world product (built offline
// by scripts/food-pipeline from the OpenNutrition dataset); `food_tokens` is
// an inverted index with a static rank so every per-token read is capped;
// `brands` maps normalized brand phrases to display names for brand-intent
// hints.

import type { WorkerFood } from "./index";

const PER_TOKEN_LIMIT = 200;
const MAX_QUERY_TOKENS = 6;
const MAX_FOODS = 40;

type FoodRow = {
  fdc_id: number;
  name: string;
  brand_owner: string | null;
  brand_name: string | null;
  category: string | null;
  ingredients: string | null;
  serving_size: number | null;
  serving_size_unit: string | null;
  household_serving: string | null;
  publication_date: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sodium: number | null;
  sugars: number | null;
  portions_json: string | null;
  quality: number;
  group_size: number;
  source_id: string | null;
  barcode: string | null;
  food_type: string | null;
};

export type D1SearchResult = {
  foods: { food: WorkerFood; quality: number }[];
  matchedBrand: string | null;
};

function normalizeForMatching(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function queryTokens(query: string): string[] {
  const seen = new Set<string>();
  for (const word of normalizeForMatching(query).split(/\s+/)) {
    if (word.length > 1) seen.add(word);
    if (seen.size >= MAX_QUERY_TOKENS) break;
  }
  return [...seen];
}

export async function searchBrandedD1(db: D1Database, query: string): Promise<D1SearchResult> {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return { foods: [], matchedBrand: null };

  const normalizedQuery = normalizeForMatching(query);
  // Brand phrases to try: the full query plus its leading 1-2 word prefixes
  // ("diet coke zero" -> "diet coke zero", "diet coke", "diet").
  const words = normalizedQuery.split(/\s+/);
  const brandPhrases = [...new Set([normalizedQuery, words.slice(0, 2).join(" "), words[0]])].filter(Boolean);

  const statements = [
    ...tokens.map((token) =>
      db
        .prepare(`SELECT fdc_id, rank FROM food_tokens WHERE token = ?1 ORDER BY rank DESC LIMIT ${PER_TOKEN_LIMIT}`)
        .bind(token)
    ),
    db
      .prepare(
        `SELECT token, brand_name FROM brands WHERE token IN (${brandPhrases.map((_, i) => `?${i + 1}`).join(",")})`
      )
      .bind(...brandPhrases),
  ];
  const results = await db.batch(statements);

  // Longest matching brand phrase wins ("diet coke" over "diet").
  const brandRows = (results[results.length - 1]?.results ?? []) as { token: string; brand_name: string }[];
  const matchedBrandRow = brandRows.sort((a, b) => b.token.length - a.token.length)[0] ?? null;

  // Intersect token hits: require every token; fall back to most-tokens-matched
  // when the strict intersection is empty (typos, stray words).
  const hits = new Map<number, { count: number; rankSum: number }>();
  for (let i = 0; i < tokens.length; i++) {
    for (const row of (results[i]?.results ?? []) as { fdc_id: number; rank: number }[]) {
      const hit = hits.get(row.fdc_id);
      if (hit) {
        hit.count++;
        hit.rankSum += row.rank;
      } else {
        hits.set(row.fdc_id, { count: 1, rankSum: row.rank });
      }
    }
  }
  let candidates = [...hits.entries()].filter(([, hit]) => hit.count === tokens.length);
  if (candidates.length === 0) {
    candidates = [...hits.entries()];
  }
  candidates.sort((a, b) => b[1].count - a[1].count || b[1].rankSum - a[1].rankSum);
  const ids = candidates.slice(0, MAX_FOODS).map(([fdcId]) => fdcId);
  if (ids.length === 0) return { foods: [], matchedBrand: matchedBrandRow?.brand_name ?? null };

  const rows = await db
    .prepare(`SELECT * FROM foods WHERE fdc_id IN (${ids.map(() => "?").join(",")})`)
    .bind(...ids)
    .all<FoodRow>();

  const brandToken = matchedBrandRow?.token ?? null;
  const foods = (rows.results ?? []).map((row) => ({
    food: rowToWorkerFood(row, brandToken),
    quality: row.quality,
  }));

  return { foods, matchedBrand: matchedBrandRow?.brand_name ?? null };
}

function rowToWorkerFood(row: FoodRow, brandToken: string | null): WorkerFood {
  const preview = perServingPreview(row);
  const brandMatch = Boolean(
    brandToken &&
      (normalizeForMatching(row.brand_name).includes(brandToken) ||
        normalizeForMatching(row.brand_owner).includes(brandToken))
  );
  return {
    id: row.fdc_id,
    name: row.name,
    brand: row.brand_owner,
    brandName: row.brand_name,
    category: row.category,
    ingredients: row.ingredients,
    dataType: row.food_type ?? "grocery",
    servingSize: preview.servingSize,
    householdServing: row.household_serving,
    calories: preview.calories,
    protein: preview.protein,
    carbs: preview.carbs,
    fat: preview.fat,
    fiber: preview.fiber,
    sodium: preview.sodium,
    // Still a preview: tapping fetches /detail, which serves this food from D1
    // with its package-size portions. Marking it complete would skip that.
    isSearchPreview: true,
    canonical: true,
    brandMatch,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Per-serving preview nutrition, mirroring buildPreviewNutrition for live
 * results: stored values are per 100 g/ml; scale to the label serving. */
function perServingPreview(row: FoodRow) {
  const amount = Number.isFinite(row.serving_size) && (row.serving_size ?? 0) > 0 ? (row.serving_size as number) : null;
  const unit = row.serving_size_unit === "g" || row.serving_size_unit === "ml" ? row.serving_size_unit : null;
  const factor = amount && unit ? amount / 100 : 1;
  return {
    servingSize: amount && unit ? `${Number(amount.toFixed(1))} ${unit}` : "100 g",
    calories: Math.round(row.calories * factor),
    protein: round1(row.protein * factor),
    carbs: round1(row.carbs * factor),
    fat: round1(row.fat * factor),
    fiber: row.fiber === null ? undefined : round1(row.fiber * factor),
    sodium: row.sodium === null ? undefined : Math.round(row.sodium * factor),
  };
}

/** Detail response for a canonical food. Returns null when the id isn't in
 * D1 (caller returns a clean "not found" — there's no other source left). */
export async function getFoodDetailD1(db: D1Database, id: number): Promise<Record<string, unknown> | null> {
  const row = await db.prepare("SELECT * FROM foods WHERE fdc_id = ?1").bind(id).first<FoodRow>();
  if (!row) return null;

  const amount = Number.isFinite(row.serving_size) && (row.serving_size ?? 0) > 0 ? (row.serving_size as number) : null;
  const unit = row.serving_size_unit === "g" || row.serving_size_unit === "ml" ? row.serving_size_unit : null;
  const factor = amount && unit ? amount / 100 : 1;
  const perServing = (value: number | null) => (value === null ? undefined : Math.round(value * factor * 100) / 100);

  let foodPortions: unknown[] = [];
  try {
    foodPortions = row.portions_json ? JSON.parse(row.portions_json) : [];
  } catch {
    foodPortions = [];
  }

  return {
    id: row.fdc_id,
    name: row.name,
    brand: row.brand_owner,
    category: row.category,
    dataType: row.food_type ?? "grocery",
    canonical: true,
    publicationDate: row.publication_date,
    ingredients: row.ingredients,
    gtinUpc: null,
    servingSize: amount && unit ? `${Number(amount.toFixed(1))} ${unit}` : row.household_serving ?? "100 g",
    servingSizeValue: amount,
    servingSizeUnit: unit,
    householdServingFullText: row.household_serving,
    foodPortions,
    labelNutrients: {
      calories: { value: perServing(row.calories) },
      protein: { value: perServing(row.protein) },
      carbohydrates: { value: perServing(row.carbs) },
      fat: { value: perServing(row.fat) },
      fiber: { value: perServing(row.fiber) },
      sodium: { value: perServing(row.sodium) },
      sugars: { value: perServing(row.sugars) },
    },
    nutrients: {
      calories: perServing(row.calories),
      protein: perServing(row.protein),
      carbs: perServing(row.carbs),
      fat: perServing(row.fat),
      fiber: perServing(row.fiber),
      sugars: perServing(row.sugars),
      sodium: perServing(row.sodium),
    },
    // The client's per-100 calorie basis (getEnergyCaloriesPer100Units) reads
    // an Energy/kcal entry; stored values are per 100 g/ml.
    foodNutrients: [{ nutrientName: "Energy", unitName: "kcal", amount: row.calories }],
    isSearchPreview: false,
  };
}
