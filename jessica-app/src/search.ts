import foodIconMappingConfig from "./assets/icons/food_icon_mapping.json";
import type { Food, FoodDetail, Recipe } from "./types";
import { getDateRangeEnding, isRecord } from "./format";
import { getSavedLog } from "./storage";

export const fallbackFoodIcon = "fork_and_knife_with_plate.svg";

export const foodIconAssetUrls = import.meta.glob("./assets/icons/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

export const foodIconRules = (foodIconMappingConfig.mapping as [string, string][])
  .map(([keyword, filename]) => [keyword.toLowerCase(), filename] as [string, string])
  .sort(([left], [right]) => right.length - left.length);

export const brandSynonyms: Record<string, string[]> = {
  "pop tart": ["pop tart", "pop-tart", "poptart", "pop-tarts", "toaster pastry", "toaster pastries"],
  "pop tarts": ["pop tart", "pop-tart", "poptart", "pop-tarts", "toaster pastry", "toaster pastries"],
  oreo: ["oreo", "oreo cookies", "chocolate sandwich cookie", "sandwich cookies"],
  oreos: ["oreo", "oreo cookies", "chocolate sandwich cookie", "sandwich cookies"],
  "cheez it": ["cheez it", "cheez-it", "cheezits", "cheese cracker", "baked cheese cracker"],
  cheezits: ["cheez it", "cheez-it", "cheezits", "cheese cracker"],
  doritos: ["doritos", "nacho cheese tortilla chips", "flavored tortilla chips", "tortilla chips"],
  pringles: ["pringles", "potato crisps", "stacked potato chips", "potato snack crisps"],
  ramen: ["ramen", "instant noodles", "instant ramen", "noodle soup mix"],
  "kraft mac and cheese": [
    "kraft mac and cheese",
    "mac and cheese",
    "macaroni and cheese",
    "boxed macaroni and cheese",
  ],
  velveeta: ["velveeta", "processed cheese", "cheese product", "shells and cheese"],
  nutella: ["nutella", "hazelnut spread", "chocolate hazelnut spread"],
  spam: ["spam", "canned luncheon meat", "luncheon meat"],
  gatorade: ["gatorade", "sports drink", "electrolyte drink"],
  "red bull": ["red bull", "energy drink"],
  "mountain dew": ["mountain dew", "citrus soda", "soft drink"],
  coke: ["coke", "coca cola", "cola", "soft drink"],
  pepsi: ["pepsi", "cola", "soft drink"],
  benadryl: ["benadryl", "diphenhydramine"],
  reeses: ["reeses", "reese's", "peanut butter cup", "chocolate peanut butter candy"],
  snickers: ["snickers", "chocolate candy bar", "peanut caramel candy bar"],
  twinkie: ["twinkie", "cream filled snack cake", "snack cake"],
  "hostess cupcake": ["hostess cupcake", "chocolate cupcake", "frosted snack cake"],
  goldfish: ["goldfish", "cheese crackers", "baked cheese crackers"],
  ritz: ["ritz", "buttery crackers", "round crackers"],
  triscuit: ["triscuit", "woven wheat crackers", "whole wheat crackers"],
  fritos: ["fritos", "corn chips"],
  cheetos: ["cheetos", "cheese puffs", "cheese curls"],
  lunchable: ["lunchable", "cracker stacker meal", "packaged lunch kit"],
};

export function matchesFoodIconKeyword(text: string, keyword: string) {
  return text.toLowerCase().includes(keyword.toLowerCase());
}

export function getFoodIconAssetUrl(filename: string) {
  return foodIconAssetUrls[`./assets/icons/${filename}`] ?? foodIconAssetUrls[`./assets/icons/${fallbackFoodIcon}`];
}

export function getFoodIconUrl(food: Pick<Food, "name" | "brand" | "category" | "dataType">) {
  const name = food.name.toLowerCase();
  const match = foodIconRules.find(([keyword]) => matchesFoodIconKeyword(name, keyword));
  return getFoodIconAssetUrl(match?.[1] ?? fallbackFoodIcon);
}

export function getRecentFoods(selectedDate: string) {
  const recentFoodMap = new Map<number, Food & { loggedCount: number; lastLoggedDate: string }>();

  for (const date of getDateRangeEnding(selectedDate, 7)) {
    for (const item of getSavedLog(date)) {
      const current = recentFoodMap.get(item.id);

      if (!current) {
        recentFoodMap.set(item.id, {
          id: item.id,
          name: item.name,
          brand: item.brand,
          servingSize: item.servingSize,
          amount: item.amount,
          amountUnit: item.amountUnit,
          portionLabel: item.portionLabel,
          portionScale: item.portionScale,
          servingLabel: item.servingLabel,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          loggedCount: 1,
          lastLoggedDate: date,
        });
        continue;
      }

      recentFoodMap.set(item.id, {
        ...current,
        loggedCount: current.loggedCount + 1,
        lastLoggedDate: current.lastLoggedDate > date ? current.lastLoggedDate : date,
      });
    }
  }

  return [...recentFoodMap.values()].sort((a, b) => {
    if (b.loggedCount !== a.loggedCount) return b.loggedCount - a.loggedCount;
    return b.lastLoggedDate.localeCompare(a.lastLoggedDate);
  });
}

export function matchesFoodQuery(food: Food, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return `${food.name} ${food.brand ?? ""}`.toLowerCase().includes(normalizedQuery);
}

export function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getSearchTokens(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

export function getSearchSynonyms(query: string) {
  const queryText = normalizeSearchText(query);
  const compactQuery = queryText.replace(/\s+/g, "");
  const directSynonyms = brandSynonyms[queryText];
  const compactSynonyms = Object.entries(brandSynonyms).find(
    ([key]) => normalizeSearchText(key).replace(/\s+/g, "") === compactQuery
  )?.[1];

  return [...new Set((directSynonyms ?? compactSynonyms ?? []).map(normalizeSearchText))];
}

export function getFoodSearchScore(food: Food, query: string) {
  const queryText = normalizeSearchText(query);
  const queryWords = getSearchTokens(query);
  if (!queryText || queryWords.length === 0) return 0;

  const nameText = normalizeSearchText(food.name);
  const brandText = normalizeSearchText(food.brand ?? "");
  const servingText = normalizeSearchText(food.servingSize);
  const dataTypeText = normalizeSearchText(food.dataType ?? "");
  const searchableText = `${nameText} ${brandText} ${servingText}`.trim();
  const compactName = nameText.replace(/\s+/g, "");
  const compactQuery = queryText.replace(/\s+/g, "");
  const matchedNameWords = queryWords.filter((word) => nameText.includes(word));
  const matchedSearchWords = queryWords.filter((word) => searchableText.includes(word));
  const synonymMatches = getSearchSynonyms(query).filter(
    (synonym) => nameText.includes(synonym) || brandText.includes(synonym)
  );
  let score = 0;
  

  // Foundation/SR descriptions are authoritative — boost when all query words appear in the name itself.
  if (dataTypeText === "foundation" || dataTypeText === "sr legacy") {
    if (matchedNameWords.length === queryWords.length && queryWords.length > 0) score += 30;
  }
  if (searchableText.includes(queryText)) score += 130;
  if (matchedSearchWords.length === queryWords.length) score += 95;
  if (nameText.includes(queryText) || compactName.includes(compactQuery)) score += 100;
  if (synonymMatches.length > 0) score += 95 + synonymMatches.length * 8;
  if (matchedNameWords.length === queryWords.length) score += 70;
  if (nameText.startsWith(queryText)) score += 50;
  // Only boost for brand when the full query is in the brand name (user searched for a brand),
  // not for incidental single-word overlap between brand and query.
  if (brandText.includes(queryText)) score += 45;
  if (brandText && getSearchTokens(brandText).every((word) => queryWords.includes(word))) score += 40;
  score += matchedSearchWords.length * 16;
  score += matchedNameWords.length * 12;

  if (queryWords.length > 1 && matchedSearchWords.length === 1) score -= 45;
  if (matchedSearchWords.length === 0 && !brandText.includes(queryText)) score -= 60;

  return score;
}

export function rankSearchResults(foods: Food[], query: string) {
  return [...foods].sort((a, b) => getFoodSearchScore(b, query) - getFoodSearchScore(a, query));
}

export function allowsGenericFoodNameSimplification(food: Food) {
  const dataType = normalizeSearchText(food.dataType ?? "");
  return dataType === "foundation" || dataType === "sr legacy";
}

export function detectMilkType(food: Food) {
  if (!allowsGenericFoodNameSimplification(food)) return null;

  const rawText = `${food.name} ${food.brand ?? ""} ${food.category ?? ""}`.toLowerCase();
  const name = normalizeSearchText(food.name);
  const brand = normalizeSearchText(food.brand ?? "");
  const category = normalizeSearchText(food.category ?? "");
  const text = `${name} ${brand} ${category}`.trim();
  const appearsToBeMilk =
    /\bmilk\b/.test(name) ||
    /\bmilk\b/.test(category) ||
    category.includes("milk substitutes");

  if (!appearsToBeMilk) return null;

  // Plant-based milks are not dairy — don't classify by fat content
  if (/\b(almond|soy|oat|coconut|cashew|rice|hemp|flax|pea|macadamia|hazelnut|walnut|pistachio)\b/.test(name)) return null;

  if (/\b(whole|vitamin d|full fat|homogenized)\b/.test(text)) return "Whole Milk";
  if (/(^|\s)2\s*%|\breduced fat\b/.test(rawText) || /\breduced fat\b/.test(text)) return "2% Milk";
  if (/(^|\s)1\s*%/.test(rawText) || /\blowfat\b|\blow fat\b/.test(text)) return "1% Milk";
  if (/\b(skim|nonfat|non fat|fat free)\b/.test(text)) return "Skim Milk";

  if (food.fat <= 0.5) return "Skim Milk";
  if (food.fat <= 2.5) return "1% Milk";
  if (food.fat <= 5.5) return "2% Milk";
  if (food.fat >= 6) return "Whole Milk";

  return null;
}

export function removeDuplicateDisplayNameSuffix(name: string) {
  const parts = name.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return name;

  const firstPart = parts[0];
  const keptParts = [firstPart];
  const firstWords = new Set(normalizeSearchText(firstPart).split(/\s+/).filter(Boolean));

  for (const part of parts.slice(1)) {
    const partWords = normalizeSearchText(part).split(/\s+/).filter(Boolean);
    const isDuplicateQualifier =
      partWords.length > 0 &&
      partWords.every((word) => firstWords.has(word)) &&
      normalizeSearchText(firstPart).startsWith(partWords.join(" "));

    if (!isDuplicateQualifier) keptParts.push(part);
  }

  return keptParts.join(", ");
}

export function formatDisplayName(name: string) {
  const trimmedName = name.trim();
  const hasLetters = /[a-z]/i.test(trimmedName);
  const isAllCaps = hasLetters && trimmedName === trimmedName.toUpperCase();

  if (!isAllCaps) return removeDuplicateDisplayNameSuffix(trimmedName);

  return removeDuplicateDisplayNameSuffix(trimmedName
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bUsda\b/g, "USDA"));
}

export function getFoodDisplayName(food: Food) {
  const milkType = detectMilkType(food);

  if (!milkType) return formatDisplayName(food.name);

  return `Milk, ${milkType.replace(" Milk", "")}`;
}

export function getBrandDisplayName(brand: string | null | undefined) {
  return brand ? formatDisplayName(brand) : "Generic";
}

export const WORKER_BASE_URL = "https://jessica-worker.snack-bunker.workers.dev";

export const foodDetailCache = new Map<number, FoodDetail>();

// ── Local food database ──────────────────────────────────────────────────────

export type LocalFoodEntry = {
  id: number;
  category: string;
  name: string;
  preparation: string;
  serving: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  source: string;
  notes: string;
  measurementType?: "solid" | "liquid" | "spoonable";
};

let localFoodsCache: LocalFoodEntry[] | null = null;

export async function getLocalFoods(): Promise<LocalFoodEntry[]> {
  if (localFoodsCache) return localFoodsCache;
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}foods.json`);
    const data = await res.json() as { foods: LocalFoodEntry[] };
    localFoodsCache = data.foods;
    return localFoodsCache;
  } catch {
    return [];
  }
}

export function localFoodToFood(entry: LocalFoodEntry): Food {
  return {
    id: entry.id,
    name: entry.name,
    brand: null,
    category: entry.category,
    source: entry.source,
    dataType: "local",
    servingSize: "100 g",
    calories: entry.calories,
    protein: entry.protein,
    carbs: entry.carbs,
    fat: entry.fat,
    fiber: entry.fiber,
    sodium: entry.sodium,
    notes: entry.notes || undefined,
    isSearchPreview: false,
    measurementType: entry.measurementType,
  };
}

export async function searchLocalFoods(query: string): Promise<Food[]> {
  const foods = await getLocalFoods();
  const queryText = normalizeSearchText(query);
  if (!queryText) return [];

  return foods
  .filter(entry => {
    const name = normalizeSearchText(entry.name);
    const cat = normalizeSearchText(entry.category);
    const tokens = queryText.split(/\s+/);
    return tokens.every(token =>
      new RegExp(`\\b${token}s?\\b`, "i").test(name) ||
      new RegExp(`\\b${token}s?\\b`, "i").test(cat)
);
  })
  .map(localFoodToFood)
  .sort((a, b) => getFoodSearchScore(b, query) - getFoodSearchScore(a, query))
  .slice(0, 10);
}

export async function getAllLocalFoods(): Promise<Food[]> {
  return (await getLocalFoods()).map(localFoodToFood);
}

export function asFoodArray(value: unknown): Food[] {
  if (Array.isArray(value)) return value as Food[];
  if (isRecord(value) && Array.isArray(value.foods)) return value.foods as Food[];
  return [];
}

export async function fetchUsdaFoods(query: string): Promise<Food[]> {
  const res = await fetch(
    `${WORKER_BASE_URL}/?query=${encodeURIComponent(query)}`
  );

  return asFoodArray(await res.json());
}

export async function fetchUsdaFoodDetail(foodId: number): Promise<FoodDetail> {
  const cached = foodDetailCache.get(foodId);
  if (cached) return cached;

  const res = await fetch(
    `${WORKER_BASE_URL}/detail?id=${encodeURIComponent(foodId)}`
  );

  const detail = await res.json() as FoodDetail;
  foodDetailCache.set(foodId, detail);
  return detail;
}

export async function searchUsdaFoodsWithSynonyms(query: string) {
  const localResults = await searchLocalFoods(query);

  // Always add local results first — they are protected from dedup
  const foodsById = new Map<number, Food>();
  for (const food of localResults) {
    foodsById.set(food.id, food);
  }

  // Only call USDA if local results are sparse
  if (localResults.length >= 1) {
    return rankSearchResults([...foodsById.values()], query);
  }

  // Fall through to USDA for packaged/branded foods
  const searchQueries = [...new Set([query, ...getSearchSynonyms(query)])];
  const resultSets = await Promise.all(searchQueries.map(fetchUsdaFoods));

  for (const foods of resultSets) {
    if (!Array.isArray(foods)) continue;
    for (const food of foods) {
      const isDuplicatedLocally = localResults.some(local =>
        normalizeSearchText(local.name).replace(/\s+/g, "") ===
        normalizeSearchText(food.name).replace(/\s+/g, "")
      );
      if (!foodsById.has(food.id) && !isDuplicatedLocally) {
        foodsById.set(food.id, food);
      }
    }
  }

  return rankSearchResults([...foodsById.values()], query);
}



// ── Grouped search results ────────────────────────────────────────────────────

export type SearchResultGroup = {
  label: string;
  foods: Food[];
};

/**
 * Returns search results split into labelled groups:
 * "My Foods" (custom foods + recent), "Whole Foods" (local DB), "Packaged" (USDA).
 * Groups with no results are omitted.
 */

export async function searchFoodsGrouped(
  query: string,
  customFoods: Food[] = [],
  recentFoods: Food[] = [],
  recipes: Recipe[] = []
): Promise<SearchResultGroup[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const safeCustomFoods = Array.isArray(customFoods) ? customFoods : [];
  const safeRecentFoods = Array.isArray(recentFoods) ? recentFoods : [];
  const safeRecipes = Array.isArray(recipes) ? recipes : [];

  // My Foods: custom foods + recipes that match the query
  const myFoods: Food[] = [
    ...safeCustomFoods.filter(f => matchesFoodQuery(f, query)),
    ...safeRecipes.filter(f => matchesFoodQuery(f, query)),
  ];

  // Recent: recently logged foods matching the query (not already in myFoods)
  const myFoodIds = new Set(myFoods.map(f => f.id));
  const recentMatches = safeRecentFoods.filter(
    f => matchesFoodQuery(f, query) && !myFoodIds.has(f.id)
  );

  // Local DB foods
  const localResults = await searchLocalFoods(query);

  // USDA packaged foods
  const searchQueries = [...new Set([query, ...getSearchSynonyms(query)])];
  const resultSets = await Promise.all(searchQueries.map(fetchUsdaFoods));
  const localIds = new Set(localResults.map(f => f.id));
  const usdaById = new Map<number, Food>();
  for (const foods of resultSets) {
    if (!Array.isArray(foods)) continue;
    for (const food of foods) {
      const isDuplicatedLocally = localResults.some(local =>
        normalizeSearchText(local.name).replace(/\s+/g, "") ===
        normalizeSearchText(food.name).replace(/\s+/g, "")
      );
      if (!localIds.has(food.id) && !usdaById.has(food.id) && !isDuplicatedLocally) {
        usdaById.set(food.id, food);
      }
    }
  }
  const usdaResults = rankSearchResults([...usdaById.values()], query);

  const groups: SearchResultGroup[] = [];

  const myFoodsAll = [...rankSearchResults(myFoods, query), ...rankSearchResults(recentMatches, query)];
  if (myFoodsAll.length > 0) groups.push({ label: "My Foods", foods: myFoodsAll });
  if (localResults.length > 0) groups.push({ label: "Whole Foods", foods: localResults });
  if (usdaResults.length > 0) groups.push({ label: "Packaged", foods: usdaResults.slice(0, 15) });

  return groups;
}
