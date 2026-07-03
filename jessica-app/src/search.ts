import foodIconMappingConfig from "./assets/icons/food_icon_mapping.json";
import type { Food, FoodDetail, ImportedRecipe, PrefillData, Recipe } from "./types";
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

  return `${food.name} ${food.brand ?? ""} ${food.brandName ?? ""}`.toLowerCase().includes(normalizedQuery);
}

export function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function getSearchTokens(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

/** Whether two normalized words match, tolerating a simple singular/plural difference
 * ("egg" ↔ "eggs", "tomato" ↔ "tomatoes"). */
function wordsMatchLoosely(a: string, b: string) {
  if (a === b) return true;
  if (a === `${b}s` || b === `${a}s`) return true;
  if (a === `${b}es` || b === `${a}es`) return true;
  return false;
}

/** Whether `word` appears in `text` as a whole word (not a substring — "ice" must not
 * match "juice"), with singular/plural tolerance. `text` must already be normalized. */
export function hasWholeWord(text: string, word: string) {
  return text.split(/\s+/).some((textWord) => wordsMatchLoosely(textWord, word));
}

/** Whether `phrase` appears in `text` on word boundaries ("ice cream" matches
 * "ice cream, vanilla" but "rice" does not match "price"). Both must be normalized. */
export function hasWholePhrase(text: string, phrase: string) {
  return phrase !== "" && new RegExp(`\\b${phrase}\\b`).test(text);
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

/** Category-taxonomy terms (NOT product/brand names) that denote a base/staple food.
 * Matched against a food's category string to nudge a brand's flagship product above its
 * derivatives — any brand whose category contains one of these benefits equally. */
const BASE_FOOD_CATEGORY_TERMS = [
  "butter", "spread", "cheese", "milk", "yogurt", "oil", "cereal", "bread", "sauce", "juice",
];

/** Count combo/bundle signals in a raw (punctuation-intact) product name. Multi-product
 * packaged names ("X & Go!", "A + B", "12 oz pack") are derivatives, not the base product.
 * Runs on the raw name because normalizeSearchText strips the "&"/"+" punctuation. Deliberately
 * omits " with " / " and " — those appear in legitimate descriptions ("spread with cocoa",
 * "mac and cheese"). */
function countComboSignals(rawName: string): number {
  const text = rawName.toLowerCase();
  let signals = 0;
  if (/\s&\s/.test(text)) signals++;
  if (/\s\+\s/.test(text)) signals++;
  if (/go!/.test(text) || /\bto go\b/.test(text)) signals++;
  if (/\b\d+\s*(oz|ct|count|pack|pk)\b/.test(text)) signals++;
  return signals;
}

/** Comma segments of a generic USDA name that merely credit the manufacturer
 * ("Beverages, The COCA-COLA company, DASANI, water…"). Such segments must not
 * collect name-match bonuses — the user searching "coca cola" wants the drink,
 * not every product the company makes. */
const CORPORATE_SEGMENT_RE = /\b(company|co|inc|incorporated|corp|corporation|brands|bottling|llc|ltd)\b/i;

function stripManufacturerSegments(name: string): string {
  const segments = name.split(",");
  if (segments.length < 2) return name;
  const kept = segments.filter((segment, index) => index === 0 || !CORPORATE_SEGMENT_RE.test(segment));
  return kept.join(",");
}

export function getFoodSearchScore(food: Food, query: string) {
  const queryText = normalizeSearchText(query);
  const queryWords = getSearchTokens(query);
  if (!queryText || queryWords.length === 0) return 0;

  const dataTypeText = normalizeSearchText(food.dataType ?? "");
  // Non-branded (generic USDA) names drop manufacturer segments before any
  // matching, so "The COCA-COLA company" in a DASANI entry earns nothing for
  // the query "coca cola". Branded names keep theirs — there the brand IS the product.
  const rawName = dataTypeText === "branded" ? String(food.name ?? "") : stripManufacturerSegments(String(food.name ?? ""));
  const nameText = normalizeSearchText(rawName);
  const brandText = normalizeSearchText(food.brand ?? "");
  const brandNameText = normalizeSearchText(food.brandName ?? "");
  const categoryText = normalizeSearchText(food.category ?? "");
  // Include brandName + category (servingSize was the constant "details required" — dead noise).
  // This lets a bare-brand query match via the existing substring/word signals below.
  const searchableText = `${nameText} ${brandText} ${brandNameText} ${categoryText}`.trim();

  // Brand-intent: the query is brand-flavored. Only for Branded foods with a real brandName, so
  // it never touches a Foundation/whole food. Fires when the query IS the brand, contains the
  // brand as a phrase, the worker's D1 brands table flagged it, or a brand synonym maps to it.
  const brandIntent =
    dataTypeText === "branded" &&
    brandNameText !== "" &&
    (queryText === brandNameText ||
      food.brandMatch === true ||
      hasWholePhrase(queryText, brandNameText) ||
      getSearchSynonyms(query).some((synonym) => synonym === brandNameText));
  // Under brand-intent, a product name that merely echoes its own brand ("Nutella & Go!…") is not
  // evidence it's the right product — strip the brand words so the name-position bonuses below
  // reward the actual food name, not brand-stuffing. Otherwise match against the full name.
  const brandNameTokens = getSearchTokens(brandNameText);
  const nameForMatching = brandIntent
    ? nameText.split(/\s+/).filter((word) => !brandNameTokens.includes(word)).join(" ")
    : nameText;

  const compactName = nameForMatching.replace(/\s+/g, "");
  const compactQuery = queryText.replace(/\s+/g, "");
  // Whole-word matching so "ice" can't collect bonuses from "juice"/"sliced".
  const matchedNameWords = queryWords.filter((word) => hasWholeWord(nameForMatching, word));
  const matchedSearchWords = queryWords.filter((word) => hasWholeWord(searchableText, word));
  const synonymMatches = getSearchSynonyms(query).filter(
    (synonym) => hasWholePhrase(nameText, synonym) || hasWholePhrase(brandText, synonym)
  );
  let score = 0;
  

  // Foundation/SR descriptions are authoritative — boost when all query words appear in the name itself.
  const isWholeFoodData = dataTypeText === "foundation" || dataTypeText === "sr legacy";
  const allQueryWordsInName = matchedNameWords.length === queryWords.length && queryWords.length > 0;
  if (isWholeFoodData && allQueryWordsInName) score += 30;
  // Whole-food priority: keep Foundation/SR Legacy (USDA's highest-quality data) above branded
  // products for the same query — the client re-rank would otherwise flatten the worker's tier
  // order, letting a brand named after a staple ("Milk") outrank the real whole food.
  if (isWholeFoodData && allQueryWordsInName) score += 90;
  if (hasWholePhrase(searchableText, queryText)) score += 130;
  if (matchedSearchWords.length === queryWords.length) score += 95;
  // Compact matching handles squished brand spellings ("cheez it" → "CHEEZ-IT"); multi-word
  // queries only, so a short single word can't substring-match inside a longer one.
  if (hasWholePhrase(nameForMatching, queryText) || (queryWords.length > 1 && compactName.includes(compactQuery))) score += 100;
  if (synonymMatches.length > 0) score += 95 + synonymMatches.length * 8;
  if (matchedNameWords.length === queryWords.length) score += 70;
  if (nameForMatching.startsWith(queryText)) score += 50;
  // Only boost for brand when the full query is in the brand name (user searched for a brand),
  // not for incidental single-word overlap between brand and query.
  if (hasWholePhrase(brandText, queryText)) score += 45;
  if (brandText && getSearchTokens(brandText).every((word) => queryWords.includes(word))) score += 40;
  score += matchedSearchWords.length * 16;
  score += matchedNameWords.length * 12;

  if (queryWords.length > 1 && matchedSearchWords.length === 1) score -= 45;
  if (matchedSearchWords.length === 0 && !brandText.includes(queryText)) score -= 60;

  // Brand-intent: a bare-brand search ("nutella") wants that brand's products.
  if (brandIntent) {
    score += 120;
    // Among a brand's products, strongly prefer its flagship — the one in a base/staple food
    // category ("Nut & Seed Butters" → spread), not its cookie/cereal/snack spin-offs or the
    // bundles/derivatives that merely name-drop the brand. Category is taxonomy, not a food name.
    if (BASE_FOOD_CATEGORY_TERMS.some((term) => categoryText.includes(term))) score += 150;
  }

  // Combo/bundle penalty — graduated and capped so it reorders without burying a real match.
  const comboSignals = countComboSignals(food.name);
  if (comboSignals > 0) score -= Math.min(comboSignals * 20, 50);

  // Conciseness tiebreaker — tiny per-word decrement; only decides near-ties, favouring the
  // shortest (usually the base) product. Negligible against the +12/+16-per-word match signals.
  const nameWordCount = nameText.split(/\s+/).filter(Boolean).length;
  score -= nameWordCount * 2;

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

// Defaults to the deployed worker; override with VITE_WORKER_URL (e.g. a local `wrangler dev`).
export const WORKER_BASE_URL =
  import.meta.env.VITE_WORKER_URL ?? "https://jessica-worker.snack-bunker.workers.dev";

export const foodDetailCache = new Map<number, FoodDetail>();

// ── Fuzzy token matching ─────────────────────────────────────────────────────

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      row[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, row[j], row[j - 1]);
      prev = tmp;
    }
  }
  return row[n];
}

function tokenMatchesWords(token: string, words: string[]): boolean {
  for (const w of words) {
    if (w === token) return true;
    if (w.startsWith(token)) return true;
    if (w.includes(token)) return true;
    // Typo tolerance, but only for 5+ letter tokens: at length 4 an edit-distance
    // of 1 collides too easily with unrelated real words ("coke"↔"cake",
    // "coca"↔"cola", "beef"↔"beet"), which then wrongly short-circuits the USDA
    // search away from the brand the user actually typed.
    if (token.length >= 5 && Math.abs(w.length - token.length) <= 2 && levenshtein(token, w) <= 1) return true;
  }
  return false;
}

export function matchesLocalFoodQuery(name: string, category: string, query: string): boolean {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const nameWords = normalizeSearchText(name).split(/\s+/).filter(Boolean);
  const catWords = normalizeSearchText(category).split(/\s+/).filter(Boolean);
  const allWords = [...nameWords, ...catWords];
  return tokens.every(token => tokenMatchesWords(token, allWords));
}

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
  .filter(entry => matchesLocalFoodQuery(entry.name, entry.category, queryText))
  .map(localFoodToFood)
  .sort((a, b) => getFoodSearchScore(b, query) - getFoodSearchScore(a, query))
  .slice(0, 10);
}

export async function getAllLocalFoods(): Promise<Food[]> {
  return (await getLocalFoods()).map(localFoodToFood);
}

/**
 * Offline best-effort match of an ingredient name to foods the user already has
 * (custom foods first, then the built-in local database). No USDA / network.
 * Returns best matches first, for the recipe-screenshot ingredient review.
 */
export async function matchIngredientToFoods(query: string, customFoods: Food[]): Promise<Food[]> {
  const q = query.trim();
  if (!q) return [];

  const custom = customFoods
    .filter((food) => matchesFoodQuery(food, q))
    .sort((a, b) => getFoodSearchScore(b, q) - getFoodSearchScore(a, q));
  const local = await searchLocalFoods(q);

  const seen = new Set<number>();
  return [...custom, ...local]
    .filter((food) => (seen.has(food.id) ? false : (seen.add(food.id), true)))
    .slice(0, 8);
}

export function asFoodArray(value: unknown): Food[] {
  if (Array.isArray(value)) return value as Food[];
  if (isRecord(value) && Array.isArray(value.foods)) return value.foods as Food[];
  return [];
}

// Session cache of worker search results, so repeating a search is instant.
// Only successful lookups are cached; failures always retry.
const usdaSearchCache = new Map<string, Food[]>();

export async function fetchUsdaFoods(query: string, liveUsdaEnabled = true): Promise<Food[]> {
  const cacheKey = `${liveUsdaEnabled ? "live" : "d1"}:${normalizeSearchText(query)}`;
  const cached = usdaSearchCache.get(cacheKey);
  if (cached) return cached;

  const res = await fetch(
    `${WORKER_BASE_URL}/?query=${encodeURIComponent(query)}${liveUsdaEnabled ? "" : "&liveUsda=0"}`
  );
  if (!res.ok) throw new Error("USDA search failed.");

  const foods = asFoodArray(await res.json());
  usdaSearchCache.set(cacheKey, foods);
  return foods;
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

/** Look up a scanned barcode via the worker → Open Food Facts. Returns null when not found. */
export async function fetchProductByBarcode(code: string): Promise<PrefillData | null> {
  const res = await fetch(`${WORKER_BASE_URL}/barcode?code=${encodeURIComponent(code)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Barcode lookup failed.");
  return (await res.json()) as PrefillData;
}

/** Import a recipe from a URL via the worker's schema.org JSON-LD scraper. */
export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const res = await fetch(`${WORKER_BASE_URL}/recipe?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    let message = "Could not import that recipe.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return (await res.json()) as ImportedRecipe;
}

/** Fetch USDA results for a query plus its brand synonyms, in parallel. Individual request
 * failures are tolerated; `failed` is true only when every request failed. */
async function fetchUsdaResultSets(query: string, liveUsdaEnabled = true): Promise<{ resultSets: Food[][]; failed: boolean }> {
  const searchQueries = [...new Set([query, ...getSearchSynonyms(query)])];
  const settled = await Promise.allSettled(searchQueries.map((searchQuery) => fetchUsdaFoods(searchQuery, liveUsdaEnabled)));
  const resultSets = settled
    .filter((r): r is PromiseFulfilledResult<Food[]> => r.status === "fulfilled")
    .map((r) => r.value);
  return { resultSets, failed: resultSets.length === 0 };
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
  const { resultSets } = await fetchUsdaResultSets(query);

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

export type SearchFoodsResult = {
  groups: SearchResultGroup[];
  /** True when USDA was attempted and every request failed (network/worker error). */
  usdaError: boolean;
  /** Why live USDA wasn't queried, when it wasn't: toggle off, or a local-DB hit short-circuited it. */
  usdaSkipped: "disabled" | "local-hit" | null;
};

/**
 * Returns search results split into labelled groups:
 * "My Foods" (custom foods + recent), "Whole Foods" (local DB), "Packaged" (D1 canonical
 * database plus live USDA when enabled), plus flags describing whether/why live USDA was
 * skipped or failed.
 * Groups with no results are omitted.
 */

export async function searchFoodsGrouped(
  query: string,
  customFoods: Food[] = [],
  recentFoods: Food[] = [],
  recipes: Recipe[] = [],
  usdaEnabled = true
): Promise<SearchFoodsResult> {
  const q = query.trim().toLowerCase();
  if (!q) return { groups: [], usdaError: false, usdaSkipped: null };
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

  // Packaged foods come from the worker. With live USDA on, a local hit still
  // short-circuits the network call entirely (predictable + offline-friendly).
  // With live USDA off, we still query the worker in D1-only mode so the
  // canonical branded database remains available without live USDA API results.
  let usdaResults: Food[] = [];
  let usdaError = false;
  const usdaSkipped: SearchFoodsResult["usdaSkipped"] =
    !usdaEnabled ? "disabled" : localResults.length > 0 ? "local-hit" : null;
  const shouldFetchPackaged = !usdaEnabled || usdaSkipped === null;
  if (shouldFetchPackaged) {
    const { resultSets, failed } = await fetchUsdaResultSets(query, usdaEnabled);
    usdaError = failed;
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
    usdaResults = rankSearchResults([...usdaById.values()], query);
  }

  const groups: SearchResultGroup[] = [];

  const myFoodsAll = [...rankSearchResults(myFoods, query), ...rankSearchResults(recentMatches, query)];
  if (myFoodsAll.length > 0) groups.push({ label: "My Foods", foods: myFoodsAll });
  if (localResults.length > 0) groups.push({ label: "Whole Foods", foods: localResults });
  if (usdaResults.length > 0) groups.push({ label: "Packaged", foods: usdaResults.slice(0, 15) });

  return { groups, usdaError, usdaSkipped };
}
