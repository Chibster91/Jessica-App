import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import { recognize } from "tesseract.js";
import { AppChrome } from "./components/AppChrome";
import { AppViewRouter } from "./components/AppViewRouter";
import {
  debugLogKey,
  googleDriveClientIdKey,
  oauthPendingActionKey,
  googleDriveScope,
  googleIdentityScriptUrl,
  emptyCustomFoodForm,
  emptyRecipeForm,
  macroPresets,
  appendDebugLog,
  setStorageJson,
  verifyStorageCount,
  getSavedLog,
  getSavedCustomFoods,
  saveCustomFoods,
  getSavedRecipes,
  getSavedWeightEntries,
  saveWeightEntries,
  getSavedCompletedDays,
  saveCompletedDays,
  getSavedTopFoods,
  saveTopFoods,
  validateImportDraft,
  parseFoodLogImportJson,
  normalizeMealName,
  getMealCategoriesForLog,
  getSavedGoals,
  getSavedProfile,
  kgToLb,
  cmToTotalInches,
  formatProfileNumber,
  profileToForm,
  profileFormFromLegacyGoals,
  getProfileHeightCm,
  getProfileWeightKg,
  getProfileGoalWeightKg,
  calculateProfile,
  getProfileValidationErrors,
  profileFormToProfile,
  profileToGoals,
  saveRecipes,
  shiftDate,
  getLocalDateString,
  getPortionOptions,
  parseServingSize,
  getMeasuredServingBasis,
  convertAmountToBasisUnit,
  getScaleFromServingBasis,
  scaleFoodNutrition,
  hasUsableSearchNutrition,
  getFoodForSelectedPortion,
  getCaloriesPerServing,
  getRecentFoods,
  matchesFoodQuery,
  getFoodDisplayName,
  getBrandDisplayName,
  getRecipeTotals,
  parseRecipe,
  foodToCustomFoodForm,
  recipeToRecipeForm,
  parseCustomFood,
  normalizeOcrText,
  parseNutritionLabelText,
  formatShortDate,
  sortWeightEntriesNewestFirst,
  sortWeightEntriesOldestFirst,
  getPreferredWeightUnit,
  getWeightRangeStartDate,
  parseDecimalInput,
  createClientId,
  getConfiguredGoogleClientId,
  getAllLocalFoods,
  searchUsdaFoodsWithSynonyms,
  searchFoodsGrouped,
  fetchUsdaFoodDetail,
  type SearchResultGroup,
  type Food,
  type RecipeIngredient,
  type Recipe,
  type FoodDetail,
  type AddFoodTab,
  type AppView,
  type FoodLibraryTab,
  type LibrarySelection,
  type TopFoodEntry,
  type Goals,
  type Profile,
  type ProfileForm,
  type WeightRange,
  type WeightEntry,
  type WeightForm,
  type CustomFoodForm,
  type FoodLogImportDraft,
  type WeightImportEntry,
  type ScannedNutritionFields,
  type RecipeForm,
  type AmountUnit,
  type GoogleDriveUploadResponse,
  type GoogleDriveFile,
  type GoogleDriveFileListResponse,
  type OAuthPendingAction,
  type MealCategory,
  type LogItem
} from "./appSupport";

interface ImportDayStep {
  date: string;
  items: FoodLogImportDraft[];
  weightEntry: WeightImportEntry | null;
}

type ImportFoodResolution = {
  food: Food;
  quantity: number;
  importAudit: {
    name: string;
    brand?: string;
    serving: string;
    quantity: string;
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    source?: string;
    notes?: string;
    resolvedSource?: string;
    resolvedFoodId?: number;
    confidence?: string;
  };
};

type ImportServingBasis = {
  amount: number;
  unitLabel: string;
  servingSize: string;
};

type ImportFoodBatchResolver = {
  byDraftId: Map<string, ImportFoodResolution>;
  addedFoodIds: Set<number>;
};

type ImportResolutionProgress = {
  resolved: number;
  total: number;
};

type ImportReviewAction = "applied" | "rejected";

type ImportMatchSource = "local" | "custom" | "recipe" | "usda";
type ImportConfidenceTier = "high" | "medium" | "low";
type ImportReviewMode = "preview" | "step";

type ImportFoodCandidate = {
  key: string;
  source: ImportMatchSource;
  sourceLabel: string;
  food: Food;
  score: number;
  confidence: ImportConfidenceTier;
  quantity: number;
  nameSimilarity: number;
  unitCompatible: boolean;
  nutritionEdge: boolean;
  specificityCoverage: number;
  genericPenalty: number;
  isGenericMatch: boolean;
};

type ImportReviewItem = {
  item: FoodLogImportDraft;
  importedFood: Food;
  candidates: ImportFoodCandidate[];
};

type ImportCandidateIndexEntry = {
  source: ImportMatchSource;
  food: Food;
  normalizedName: string;
};

type ImportFoodBatchResolverOptions = {
  forceReviewAll?: boolean;
  manualCandidates?: Record<string, ImportFoodCandidate>;
  onProgress?: (progress: ImportResolutionProgress) => void;
};

type ThemeMode = "dark" | "light";

const themeStorageKey = "theme-mode";

function getSavedThemeMode(): ThemeMode {
  return localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark";
}

function normalizeImportKeyPart(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function roundImportMacro(value: number): number {
  return Math.round(value * 10) / 10;
}

function parseImportAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const mixedFraction = trimmed.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const numerator = Number(mixedFraction[2]);
    const denominator = Number(mixedFraction[3]);
    if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return whole + numerator / denominator;
    }
  }

  const fraction = trimmed.match(/^(\d+)\s*\/\s*(\d+)/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return numerator / denominator;
    }
  }

  const decimal = trimmed.match(/^(\d+(?:[.,]\d+)?)/);
  if (!decimal) return null;

  const amount = Number(decimal[1].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function canonicalImportUnit(unit: string): string {
  const normalized = normalizeImportKeyPart(unit);
  const units: Record<string, string> = {
    c: "cup",
    cup: "cup",
    cups: "cup",
    tbsp: "tbsp",
    tbsps: "tbsp",
    tablespoon: "tbsp",
    tablespoons: "tbsp",
    tsp: "tsp",
    tsps: "tsp",
    teaspoon: "tsp",
    teaspoons: "tsp",
    "fl oz": "fl oz",
    "fluid ounce": "fl oz",
    "fluid ounces": "fl oz",
    oz: "oz",
    ounce: "oz",
    ounces: "oz",
    g: "g",
    gram: "g",
    grams: "g",
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    ml: "ml",
    milliliter: "ml",
    milliliters: "ml",
    l: "l",
    liter: "l",
    liters: "l",
    serving: "serving",
    servings: "serving",
    large: "large",
    medium: "medium",
    small: "small",
    whole: "whole",
    piece: "piece",
    pieces: "piece",
    slice: "slice",
    slices: "slice",
    container: "container",
    containers: "container",
    bottle: "bottle",
    bottles: "bottle",
    can: "can",
    cans: "can",
    bar: "bar",
    bars: "bar",
    packet: "packet",
    packets: "packet",
    pouch: "pouch",
    pouches: "pouch",
  };
  return units[normalized] ?? normalized;
}

function parseImportServingBasis(serving: string): ImportServingBasis {
  const servingText = serving.trim().replace(/^per\s+/i, "");
  const amount = parseImportAmount(servingText);
  if (amount === null) {
    const label = normalizeImportKeyPart(serving);
    return { amount: 1, unitLabel: label, servingSize: serving.trim() };
  }

  const amountPattern = /^(\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?)/;
  const unitMatch = servingText
    .replace(amountPattern, "")
    .trim()
    .match(/^(fl\s*oz|fluid\s+ounces?|tablespoons?|tbsp|teaspoons?|tsp|cups?|ounces?|oz|kilograms?|kg|grams?|g|liters?|l|milliliters?|ml|servings?|large|medium|small|whole|pieces?|slices?|containers?|bottles?|cans?|bars?|packets?|pouches?)\b/i);
  const unitLabel = canonicalImportUnit(unitMatch?.[1] ?? "");
  if (!unitLabel) {
    const label = normalizeImportKeyPart(serving);
    return { amount: 1, unitLabel: label, servingSize: serving.trim() };
  }

  return { amount, unitLabel, servingSize: `1 ${unitLabel}` };
}

function canonicalizeImportFood(food: Food): Food {
  const servingBasis = parseImportServingBasis(food.servingSize);
  if (servingBasis.amount === 1 && food.servingSize.trim() === servingBasis.servingSize) return food;

  return {
    ...food,
    servingSize: servingBasis.servingSize,
    calories: Math.round(food.calories / servingBasis.amount),
    protein: roundImportMacro(food.protein / servingBasis.amount),
    carbs: roundImportMacro(food.carbs / servingBasis.amount),
    fat: roundImportMacro(food.fat / servingBasis.amount),
  };
}

function makeImportFoodKey(food: Pick<Food, "name" | "brand" | "calories" | "protein" | "carbs" | "fat" | "servingSize">): string {
  const servingBasis = parseImportServingBasis(food.servingSize);
  return [
    normalizeImportKeyPart(food.name),
    normalizeImportKeyPart(food.brand),
    Math.round(food.calories / servingBasis.amount),
    roundImportMacro(food.protein / servingBasis.amount),
    roundImportMacro(food.carbs / servingBasis.amount),
    roundImportMacro(food.fat / servingBasis.amount),
    servingBasis.unitLabel,
  ].join("|");
}

function getImportDraftQuantity(item: FoodLogImportDraft): number {
  const quantity = parseDecimalInput(item.quantity || "1");
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function makeImportAudit(
  item: FoodLogImportDraft,
  resolvedSource?: string,
  resolvedFoodId?: number,
  confidence?: string
): ImportFoodResolution["importAudit"] {
  return {
    name: item.name,
    brand: item.brand || undefined,
    serving: item.serving,
    quantity: item.quantity,
    calories: item.calories,
    protein: item.protein,
    carbs: item.carbs,
    fat: item.fat,
    source: item.source || undefined,
    notes: item.notes || undefined,
    resolvedSource,
    resolvedFoodId,
    confidence,
  };
}

function buildImportFoodFromDraft(item: FoodLogImportDraft, id: number): ImportFoodResolution {
  const loggedQuantity = getImportDraftQuantity(item);
  const servingBasis = parseImportServingBasis(item.serving);
  const quantity = loggedQuantity * servingBasis.amount;

  const food = {
      id,
      name: item.name.trim(),
      brand: item.brand.trim() || null,
      source: item.source.trim() || undefined,
      servingSize: servingBasis.servingSize,
      calories: Math.round(parseDecimalInput(item.calories) / quantity),
      protein: roundImportMacro(parseDecimalInput(item.protein || "0") / quantity),
      carbs: roundImportMacro(parseDecimalInput(item.carbs || "0") / quantity),
      fat: roundImportMacro(parseDecimalInput(item.fat || "0") / quantity),
      notes: item.notes.trim() || undefined,
    };

  return {
    quantity,
    food,
    importAudit: makeImportAudit(item, "new", food.id, "new"),
  };
}

function normalizeImportMatchName(value: string) {
  return canonicalizeImportTokenSequence(normalizeImportKeyPart(value)
    .split(" ")
    .map(singularizeImportToken)
    .filter(Boolean))
    .sort()
    .join(" ");
}

function singularizeImportToken(word: string) {
  if (word === "cookies") return "cookie";
  if (word.length > 3 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function canonicalizeImportTokenSequence(tokens: string[]) {
  const canonical: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const next = tokens[index + 1];

    if (token === "cheezits" || token === "cheezit") {
      canonical.push("cheez", "it");
      continue;
    }
    if (token === "cheez" && (next === "its" || next === "it")) {
      canonical.push("cheez", "it");
      index += 1;
      continue;
    }
    if (token === "its") {
      canonical.push("it");
      continue;
    }

    canonical.push(token);
  }

  return canonical;
}

function normalizeImportName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function levenshteinDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[b.length];
}

function tokenSortSimilarityNormalized(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 100;
  const maxLength = Math.max(left.length, right.length);
  const ratio = maxLength === 0 ? 100 : ((maxLength - levenshteinDistance(left, right)) / maxLength) * 100;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const shared = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const containment = shared / Math.max(1, Math.min(leftTokens.size, rightTokens.size));
  return Math.max(Math.round(ratio), Math.round(containment * 100));
}

const importModifierTokens = new Set([
  "strawberry",
  "honey",
  "peanut",
  "chocolate",
  "vanilla",
  "maple",
  "barbecue",
  "bbq",
  "garlic",
  "butter",
  "cheese",
  "cheddar",
  "sweet",
  "sour",
  "spicy",
  "hot",
  "mild",
  "plain",
  "flavor",
  "flavored",
]);

const importPreparedCoreTokens = new Set([
  "yogurt",
  "protein",
  "powder",
  "bar",
  "sauce",
  "dressing",
  "twist",
  "chip",
  "cracker",
  "cereal",
  "pasta",
  "noodle",
  "tuna",
  "salad",
  "sandwich",
  "soup",
  "meal",
  "bowl",
  "wrap",
]);

const importReversePreparedTokens = new Set([
  "bar",
  "cream",
  "drink",
  "isolate",
  "mix",
  "powder",
  "protein",
  "shake",
  "smoothie",
  "whey",
  "yogurt",
]);

const importCoreFoodTokens = new Set([
  "bagel",
  "bar",
  "bean",
  "beef",
  "bread",
  "burrito",
  "cake",
  "cereal",
  "cheese",
  "chicken",
  "chip",
  "coffee",
  "cookie",
  "cracker",
  "cream",
  "dressing",
  "egg",
  "fish",
  "granola",
  "juice",
  "meal",
  "milk",
  "muffin",
  "noodle",
  "oat",
  "oatmeal",
  "pasta",
  "pork",
  "potato",
  "powder",
  "protein",
  "rice",
  "salad",
  "salmon",
  "sandwich",
  "sauce",
  "shake",
  "smoothie",
  "soup",
  "tea",
  "tuna",
  "turkey",
  "wrap",
  "yogurt",
]);

const importStopTokens = new Set([
  "a",
  "an",
  "and",
  "by",
  "for",
  "from",
  "in",
  "of",
  "or",
  "per",
  "the",
  "to",
  "with",
  "without",
]);

const importWeakSpecificityTokens = new Set([
  "added",
  "brown",
  "diet",
  "fat",
  "flavor",
  "flavored",
  "free",
  "fresh",
  "instant",
  "light",
  "low",
  "lower",
  "maple",
  "natural",
  "organic",
  "original",
  "plain",
  "reduced",
  "sugar",
  "sweetened",
  "unsweetened",
]);

const importCoreEquivalentGroups = [
  ["oat", "oatmeal"],
  ["chip", "cracker"],
  ["shake", "smoothie"],
];

function getRawImportTokens(name: string) {
  return canonicalizeImportTokenSequence(normalizeImportKeyPart(name)
    .split(" ")
    .map(singularizeImportToken)
    .filter(Boolean));
}

function getMeaningfulImportTokens(name: string) {
  return getRawImportTokens(name).filter((token) => !importStopTokens.has(token));
}

function getSpecificImportTokens(tokens: string[]) {
  return tokens.filter((token) => !importWeakSpecificityTokens.has(token));
}

function getImportNameTokens(normalizedName: string) {
  return normalizedName.split(" ").filter(Boolean);
}

function areEquivalentImportCoreTokens(left: string, right: string) {
  if (left === right) return true;
  return importCoreEquivalentGroups.some((group) => group.includes(left) && group.includes(right));
}

function hasCompatibleCoreFood(importedTokens: string[], candidateTokens: string[]) {
  const importedCoreTokens = importedTokens.filter((token) => importCoreFoodTokens.has(token));
  if (importedCoreTokens.length === 0) return true;

  const candidateCoreTokens = candidateTokens.filter((token) => importCoreFoodTokens.has(token));
  return importedCoreTokens.some((importedToken) =>
    candidateCoreTokens.some((candidateToken) => areEquivalentImportCoreTokens(importedToken, candidateToken))
  );
}

function getImportSpecificityCoverage(importedTokens: string[], candidateTokens: string[]) {
  const importedSpecificTokens = Array.from(new Set(getSpecificImportTokens(importedTokens)));
  if (importedSpecificTokens.length === 0) return 1;

  const candidateTokenSet = new Set(candidateTokens);
  const matched = importedSpecificTokens.filter((token) => candidateTokenSet.has(token)).length;
  return matched / importedSpecificTokens.length;
}

function getCandidateSpecificityCoverage(importedTokens: string[], candidateTokens: string[]) {
  const candidateSpecificTokens = Array.from(new Set(getSpecificImportTokens(candidateTokens)));
  if (candidateSpecificTokens.length === 0) return 1;

  const importedTokenSet = new Set(importedTokens);
  const matched = candidateSpecificTokens.filter((token) => importedTokenSet.has(token)).length;
  return matched / candidateSpecificTokens.length;
}

function hasUnsupportedPreparedSpecificity(importedTokens: string[], candidateTokens: string[]) {
  const importedTokenSet = new Set(importedTokens);
  const importedPreparedTokens = importedTokens.filter((token) => importReversePreparedTokens.has(token));
  const candidatePreparedTokens = candidateTokens.filter((token) => importReversePreparedTokens.has(token));

  if (importedPreparedTokens.length > 0) return false;
  return candidatePreparedTokens.some((token) => !importedTokenSet.has(token));
}

function isGenericImportCandidate(importedTokens: string[], candidateTokens: string[], specificityCoverage: number) {
  const importedSpecificCount = new Set(getSpecificImportTokens(importedTokens)).size;
  const candidateSpecificCount = new Set(getSpecificImportTokens(candidateTokens)).size;
  if (importedSpecificCount >= 5 && candidateSpecificCount <= 3 && specificityCoverage < 0.55) return true;
  return importedSpecificCount >= 2 && candidateSpecificCount < importedSpecificCount && specificityCoverage < 0.75;
}

function getImportCandidateRankScore(candidate: ImportFoodCandidate) {
  const sourceBonus: Record<ImportMatchSource, number> = { local: 30, custom: 24, recipe: 18, usda: 0 };
  return candidate.nameSimilarity +
    candidate.specificityCoverage * 35 +
    sourceBonus[candidate.source] -
    candidate.genericPenalty;
}

function hasIngredientOnlyCandidateMismatch(importedNormalizedName: string, candidateNormalizedName: string) {
  const importedTokens = getImportNameTokens(importedNormalizedName);
  const candidateTokens = getImportNameTokens(candidateNormalizedName);
  if (importedTokens.length <= 1 || candidateTokens.length === 0) return false;

  const sharedTokens = candidateTokens.filter((token) => importedTokens.includes(token));
  if (sharedTokens.length === 0) return false;

  const importedCoreTokens = importedTokens.filter((token) => !importModifierTokens.has(token));
  const importedHasPreparedCore = importedCoreTokens.some((token) => importPreparedCoreTokens.has(token));
  const candidateIsOnlyModifier = candidateTokens.every((token) => importModifierTokens.has(token));
  const candidateMissesPreparedCore = importedHasPreparedCore &&
    !candidateTokens.some((token) => importedCoreTokens.includes(token));

  return candidateIsOnlyModifier || candidateMissesPreparedCore;
}

function getHouseholdServingGrams(basis: ImportServingBasis, foodName: string): number | null {
  const name = normalizeImportMatchName(foodName);
  const servingText = normalizeImportKeyPart(`${basis.unitLabel} ${basis.servingSize}`);
  const hasUnit = (...units: string[]) => units.some((unit) => basis.unitLabel === unit || servingText.includes(unit));
  const scaled = (grams: number) => basis.amount * grams;

  if (/\begg\b/.test(name) && !/\bwhite\b/.test(name)) {
    if (hasUnit("small")) return scaled(38);
    if (hasUnit("medium")) return scaled(44);
    if (hasUnit("large", "whole", "egg", "serving", "piece")) return scaled(45);
  }
  if (/\begg\b/.test(name) && /\bwhite\b/.test(name)) {
    if (hasUnit("small")) return scaled(25);
    if (hasUnit("medium")) return scaled(30);
    if (hasUnit("large", "white", "serving", "piece")) return scaled(33);
  }
  if (/\bbanana\b/.test(name)) {
    if (hasUnit("small")) return scaled(101);
    if (hasUnit("large")) return scaled(136);
    if (hasUnit("medium", "whole", "banana", "serving", "piece")) return scaled(118);
  }
  if (/\bapple\b/.test(name)) {
    if (hasUnit("small")) return scaled(149);
    if (hasUnit("large")) return scaled(223);
    if (hasUnit("medium", "whole", "apple", "serving", "piece")) return scaled(182);
  }
  if (/\borange\b/.test(name)) {
    if (hasUnit("large")) return scaled(184);
    if (hasUnit("medium", "whole", "orange", "serving", "piece")) return scaled(131);
  }
  if (/\bavocado\b/.test(name) && hasUnit("medium", "whole", "avocado", "serving", "piece")) return scaled(136);
  if (/\bpotato\b/.test(name)) {
    if (hasUnit("small")) return scaled(138);
    if (hasUnit("large")) return scaled(299);
    if (hasUnit("medium", "whole", "potato", "serving", "piece")) return scaled(173);
  }
  if (/\btomato\b/.test(name)) {
    if (/\bcherry\b/.test(name) || hasUnit("cherry")) return scaled(17);
    if (/\broma\b/.test(name) || hasUnit("roma")) return scaled(62);
    if (hasUnit("medium", "whole", "tomato", "serving", "piece")) return scaled(123);
  }
  if (/\bonion\b/.test(name) && hasUnit("medium", "whole", "onion", "serving", "piece")) return scaled(110);
  if (/\bcarrot\b/.test(name)) {
    if (hasUnit("large")) return scaled(72);
    if (hasUnit("medium", "whole", "carrot", "serving", "piece")) return scaled(61);
  }
  if (/\bpepper\b/.test(name) && /\bbell\b/.test(name) && hasUnit("medium", "whole", "pepper", "serving", "piece")) return scaled(119);
  if (/\bcucumber\b/.test(name) && hasUnit("medium", "whole", "cucumber", "serving", "piece")) return scaled(201);
  if (/\blemon\b/.test(name) && hasUnit("whole", "lemon", "serving", "piece")) return scaled(58);
  if (/\blime\b/.test(name) && hasUnit("whole", "lime", "serving", "piece")) return scaled(67);

  return null;
}

function getImportServingGramAmount(basis: ImportServingBasis, foodName: string): number | null {
  const toBase = (servingBasis: ImportServingBasis): number | null => {
    switch (servingBasis.unitLabel) {
      case "g":
        return servingBasis.amount;
      case "kg":
        return servingBasis.amount * 1000;
      case "oz":
        return servingBasis.amount * 28.349523125;
      case "tsp":
        return servingBasis.amount * 5;
      case "tbsp":
        return servingBasis.amount * 15;
      case "cup":
        return servingBasis.amount * 240;
      case "ml":
        return servingBasis.amount;
      case "l":
        return servingBasis.amount * 1000;
      case "fl oz":
        return servingBasis.amount * 29.5735295625;
      default:
        return null;
    }
  };

  return toBase(basis) ?? getHouseholdServingGrams(basis, foodName);
}

function importFoodUnitRatio(
  from: ImportServingBasis,
  to: ImportServingBasis,
  fromFoodName: string,
  toFoodName: string
): number | null {
  if (!from.unitLabel || !to.unitLabel) return null;
  if (from.unitLabel === to.unitLabel) return from.amount / to.amount;

  const left = getImportServingGramAmount(from, fromFoodName);
  const right = getImportServingGramAmount(to, toFoodName);
  return left !== null && right !== null && right > 0 ? left / right : null;
}

function isWithinImportTolerance(imported: number, candidate: number, limit: number, percent: number) {
  const tolerance = imported > limit ? Math.abs(imported) * percent : limit === 50 ? 5 : 1;
  return Math.abs(imported - candidate) <= tolerance;
}

function comparableMacroValue(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getCalorieScaledImportQuantity(imported: ImportFoodResolution, food: Pick<Food, "calories" | "name" | "servingSize">) {
  if (!Number.isFinite(food.calories) || food.calories <= 0) {
    return getFoodQuantityRatio(imported.food, food);
  }

  const importedTotalCalories = parseDecimalInput(imported.importAudit.calories);
  if (Number.isFinite(importedTotalCalories) && importedTotalCalories > 0) {
    return importedTotalCalories / food.calories;
  }

  const reconstructedTotalCalories = imported.food.calories * imported.quantity;
  if (Number.isFinite(reconstructedTotalCalories) && reconstructedTotalCalories > 0) {
    return reconstructedTotalCalories / food.calories;
  }

  return getFoodQuantityRatio(imported.food, food);
}

function getImportFoodCandidate(
  imported: ImportFoodResolution,
  food: Food,
  source: ImportMatchSource,
  importedNormalizedName = normalizeImportMatchName(imported.food.name),
  candidateNormalizedName = normalizeImportMatchName(food.name)
): ImportFoodCandidate | null {
  const nameSimilarity = tokenSortSimilarityNormalized(importedNormalizedName, candidateNormalizedName);
  if (nameSimilarity < 65) return null;
  if (hasIngredientOnlyCandidateMismatch(importedNormalizedName, candidateNormalizedName)) return null;

  const importedTokens = getMeaningfulImportTokens(imported.food.name);
  const candidateTokens = getMeaningfulImportTokens(food.name);
  if (!hasCompatibleCoreFood(importedTokens, candidateTokens)) return null;
  if (hasUnsupportedPreparedSpecificity(importedTokens, candidateTokens)) return null;

  const importedBasis = parseImportServingBasis(imported.food.servingSize);
  const candidateBasis = parseImportServingBasis(food.servingSize);
  const ratio = importFoodUnitRatio(importedBasis, candidateBasis, imported.food.name, food.name);
  const unitCompatible = ratio !== null;
  const specificityCoverage = getImportSpecificityCoverage(importedTokens, candidateTokens);
  const candidateSpecificityCoverage = getCandidateSpecificityCoverage(importedTokens, candidateTokens);
  const isGenericMatch = isGenericImportCandidate(importedTokens, candidateTokens, specificityCoverage);
  const genericPenalty = (isGenericMatch ? 35 : 0) + (candidateSpecificityCoverage < 0.35 ? 20 : 0);
  const confidence: ImportConfidenceTier =
    nameSimilarity >= 90 ? "high" : nameSimilarity >= 75 ? "medium" : "low";
  const sourceOrder: Record<ImportMatchSource, number> = { local: 4, custom: 3, recipe: 2, usda: 1 };
  const score = nameSimilarity * 100 + sourceOrder[source];

  return {
    key: `${source}:${food.id}`,
    source,
    sourceLabel: source === "local" ? "Local" : source === "custom" ? "Custom" : source === "recipe" ? "Recipe" : "USDA",
    food,
    score,
    confidence,
    quantity: getCalorieScaledImportQuantity(imported, food),
    nameSimilarity,
    unitCompatible,
    nutritionEdge: false,
    specificityCoverage,
    genericPenalty,
    isGenericMatch,
  };
}

function rankImportCandidates(candidates: ImportFoodCandidate[]) {
  return [...candidates].sort((a, b) =>
    getImportCandidateRankScore(b) - getImportCandidateRankScore(a) ||
    b.nameSimilarity - a.nameSimilarity ||
    b.score - a.score
  );
}

function getDefaultImportReviewSelection(review: ImportReviewItem) {
  const top = review.candidates[0];
  return top ? top.key : "new";
}

const importCandidateCache = new Map<string, ImportFoodCandidate[]>();
const importUsdaCandidateCache = new Map<string, Food[]>();

function getImportResolutionKey(imported: ImportFoodResolution) {
  return makeImportFoodKey(imported.food);
}

function areDuplicateImportedFoods(left: ImportFoodResolution, right: ImportFoodResolution) {
  const leftName = normalizeImportMatchName(left.food.name);
  const rightName = normalizeImportMatchName(right.food.name);
  if (tokenSortSimilarityNormalized(leftName, rightName) < 85) return false;

  const leftBasis = parseImportServingBasis(left.food.servingSize);
  const rightBasis = parseImportServingBasis(right.food.servingSize);
  const ratio = importFoodUnitRatio(leftBasis, rightBasis, left.food.name, right.food.name);
  if (ratio === null) return false;
  if (!isWithinImportTolerance(left.food.calories, right.food.calories * ratio, 50, 0.05)) return false;

  const macroPairs: Array<[number | undefined, number | undefined]> = [
    [left.food.protein, right.food.protein],
    [left.food.carbs, right.food.carbs],
    [left.food.fat, right.food.fat],
  ];

  return macroPairs.every(([leftValue, rightValue]) => {
    const comparableLeft = comparableMacroValue(leftValue);
    const comparableRight = comparableMacroValue(rightValue);
    if (comparableLeft === null || comparableRight === null) return true;
    return isWithinImportTolerance(comparableLeft, comparableRight * ratio, 5, 0.1);
  });
}

function indexImportCandidateFoods(source: ImportMatchSource, foods: Food[]): ImportCandidateIndexEntry[] {
  return (Array.isArray(foods) ? foods : []).map((food) => ({
    source,
    food,
    normalizedName: normalizeImportMatchName(food.name),
  }));
}

async function getUsdaImportCandidates(query: string) {
  const cacheKey = normalizeImportMatchName(query);
  const cached = importUsdaCandidateCache.get(cacheKey);
  if (cached) return cached;

  try {
    const groups = await searchFoodsGrouped(query, [], [], []);
    const foods = new Map<number, Food>();
    for (const group of Array.isArray(groups) ? groups : []) {
      if (group.label !== "Packaged") continue;
      for (const food of Array.isArray(group.foods) ? group.foods : []) foods.set(food.id, food);
    }
    const candidates = [...foods.values()];
    importUsdaCandidateCache.set(cacheKey, candidates);
    return candidates;
  } catch (error) {
    appendDebugLog("import-usda-candidate-resolution-failed", {
      query,
      message: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

function buildImportCandidatesFromIndex(
  imported: ImportFoodResolution,
  index: ImportCandidateIndexEntry[]
) {
  const importedNormalizedName = normalizeImportMatchName(imported.food.name);
  return rankImportCandidates(index
    .map(({ source, food, normalizedName }) =>
      getImportFoodCandidate(imported, food, source, importedNormalizedName, normalizedName)
    )
    .filter((candidate): candidate is ImportFoodCandidate => candidate !== null));
}

function resolveImportItemFromCandidate(
  item: FoodLogImportDraft,
  imported: ImportFoodResolution,
  candidate: ImportFoodCandidate
): ImportFoodResolution {
  return {
    food: candidate.food,
    quantity: getCalorieScaledImportQuantity(imported, candidate.food),
    importAudit: makeImportAudit(item, candidate.sourceLabel, candidate.food.id, candidate.confidence),
  };
}

async function buildImportFoodBatchResolver(
  items: FoodLogImportDraft[],
  existingCustomFoods: Food[],
  existingRecipes: Recipe[],
  decisions: Record<string, string> = {},
  options: ImportFoodBatchResolverOptions = {}
): Promise<{ resolver: ImportFoodBatchResolver; reviewItems: ImportReviewItem[] }> {
  const byDraftId = new Map<string, ImportFoodResolution>();
  const reviewItems: ImportReviewItem[] = [];
  const createdByKey = new Map<string, Food>();
  const localFoods = await getAllLocalFoods().catch((error) => {
    appendDebugLog("import-local-candidate-resolution-failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return [] as Food[];
  });
  const safeCustomFoods = Array.isArray(existingCustomFoods) ? existingCustomFoods : [];
  const safeRecipes = Array.isArray(existingRecipes) ? existingRecipes : [];
  const baseCandidateIndex = [
    ...indexImportCandidateFoods("local", localFoods),
    ...indexImportCandidateFoods("custom", safeCustomFoods),
    ...indexImportCandidateFoods("recipe", safeRecipes),
  ];
  const uniqueImports = new Map<string, { item: FoodLogImportDraft; imported: ImportFoodResolution; items: FoodLogImportDraft[] }>();
  let nextFoodId = Date.now();

  for (const item of items) {
    const imported = buildImportFoodFromDraft(item, -(nextFoodId++));
    const matchingKey = [...uniqueImports.entries()].find(([, group]) =>
      areDuplicateImportedFoods(group.imported, imported)
    )?.[0];
    const key = matchingKey ?? getImportResolutionKey(imported);
    const existing = uniqueImports.get(key);
    if (existing) existing.items.push(item);
    else uniqueImports.set(key, { item, imported, items: [item] });
  }

  options.onProgress?.({ resolved: 0, total: items.length });
  let resolvedCount = 0;

  for (const [uniqueKey, group] of uniqueImports) {
    let candidates = importCandidateCache.get(uniqueKey);
    if (!candidates) {
      const baseCandidates = buildImportCandidatesFromIndex(group.imported, baseCandidateIndex);
      const bestBaseCandidate = baseCandidates[0];
      if (bestBaseCandidate && !bestBaseCandidate.isGenericMatch) {
        candidates = baseCandidates;
      } else {
        const usdaFoods = await getUsdaImportCandidates(group.item.name);
        const usdaCandidates = buildImportCandidatesFromIndex(group.imported, indexImportCandidateFoods("usda", usdaFoods));
        candidates = rankImportCandidates([...baseCandidates, ...usdaCandidates]);
      }
      importCandidateCache.set(uniqueKey, candidates);
    }
    resolvedCount += group.items.length;
    options.onProgress?.({ resolved: resolvedCount, total: items.length });

    if (options.forceReviewAll || (candidates.length > 0 && group.items.some((item) => !decisions[item.id]))) {
      group.items
        .filter((item) => options.forceReviewAll || !decisions[item.id])
        .forEach((item) => reviewItems.push({
          item,
          importedFood: buildImportFoodFromDraft(item, -Date.now()).food,
          candidates,
        }));
      continue;
    }

    for (const item of group.items) {
      const imported = buildImportFoodFromDraft(item, -(nextFoodId++));
      const decision = decisions[item.id];
      const manualCandidate = options.manualCandidates?.[item.id];
      const candidate = decision && decision !== "new"
        ? candidates.find((match) => match.key === decision) ??
          (manualCandidate?.key === decision ? manualCandidate : null)
        : null;
      if (candidate) {
        byDraftId.set(item.id, resolveImportItemFromCandidate(item, imported, candidate));
        continue;
      }

      const existingCreated = createdByKey.get(uniqueKey);
      byDraftId.set(item.id, {
        ...imported,
        food: existingCreated ?? imported.food,
        importAudit: makeImportAudit(item, "new", existingCreated?.id ?? imported.food.id, "new"),
      });
      if (!existingCreated) createdByKey.set(uniqueKey, imported.food);
    }
  }

  return { resolver: { byDraftId, addedFoodIds: new Set() }, reviewItems };
}

function getFoodQuantityRatio(fromFood: Pick<Food, "name" | "servingSize" | "calories">, toFood: Pick<Food, "name" | "servingSize" | "calories">): number {
  const fromServing = parseImportServingBasis(fromFood.servingSize);
  const toServing = parseImportServingBasis(toFood.servingSize);
  const servingRatio = importFoodUnitRatio(fromServing, toServing, fromFood.name, toFood.name);
  if (servingRatio !== null) return servingRatio;
  if (toFood.calories > 0) return fromFood.calories / toFood.calories;
  return 1;
}

function dedupeCustomFoods(foods: Food[]): { foods: Food[]; foodRemap: Map<number, Food> } {
  const keptByKey = new Map<string, Food>();
  const deduped: Food[] = [];
  const foodRemap = new Map<number, Food>();

  for (const food of foods) {
    const canonicalFood = canonicalizeImportFood(food);
    const key = makeImportFoodKey(canonicalFood);
    const kept = keptByKey.get(key);
    if (kept) {
      if (canonicalFood.id !== kept.id) foodRemap.set(canonicalFood.id, kept);
      continue;
    }
    keptByKey.set(key, canonicalFood);
    if (food !== canonicalFood) foodRemap.set(food.id, canonicalFood);
    deduped.push(canonicalFood);
  }

  return { foods: deduped, foodRemap };
}

function remapLogFoodIds(items: LogItem[], foodRemap: Map<number, Food>): LogItem[] {
  if (foodRemap.size === 0) return items;
  return items.map((item) => {
    const keptFood = foodRemap.get(item.id);
    if (!keptFood) return item;

    return {
      ...keptFood,
      logId: item.logId,
      category: item.category,
      quantity: item.quantity * getFoodQuantityRatio(item, keptFood),
    };
  });
}

function remapSavedLogFoodIds(foodRemap: Map<number, Food>) {
  if (foodRemap.size === 0) return;

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("log-")) continue;

    try {
      const saved = localStorage.getItem(key);
      const parsed = saved ? (JSON.parse(saved) as LogItem[]) : [];
      if (!Array.isArray(parsed)) continue;

      const nextLog = remapLogFoodIds(parsed, foodRemap);
      if (nextLog !== parsed) setStorageJson(key, nextLog);
    } catch {
      // Ignore malformed legacy log entries during import cleanup.
    }
  }
}

function isPwaStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/**
 * Returns the pending OAuth action if the app is loading after a PWA OAuth redirect,
 * otherwise null. Used in useState initializers so state is correct before the first render,
 * avoiding both a "home" flash and stale-closure issues in Drive actions.
 */
function getOAuthReturnPending(): OAuthPendingAction | null {
  if (!window.location.hash.includes("access_token=")) return null;
  const raw = localStorage.getItem(oauthPendingActionKey);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthPendingAction;
    return Date.now() - parsed.timestamp < 10 * 60 * 1000 ? parsed : null;
  } catch {
    return null;
  }
}

function hasSavedLocalAppData() {
  if (
    getSavedProfile() ||
    getSavedGoals() ||
    getSavedCustomFoods().length > 0 ||
    getSavedRecipes().length > 0 ||
    getSavedWeightEntries().length > 0 ||
    getSavedCompletedDays().length > 0 ||
    getSavedTopFoods().length > 0
  ) {
    return true;
  }

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("log-")) return true;
  }

  return false;
}

function App() {
  const today = getLocalDateString();
  const customFoodScanInputRef = useRef<HTMLInputElement | null>(null);
  const importFoodBatchResolverRef = useRef<ImportFoodBatchResolver | null>(null);

  const mealCardRefs = useRef<Partial<Record<MealCategory, HTMLElement | null>>>({});
  const longPressRef = useRef<{ logId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressNextClickRef = useRef<string | null>(null);
  const [appView, setAppView] = useState<AppView>(() => {
    const pending = getOAuthReturnPending();
    if (pending?.returnView) return pending.returnView;
    return hasSavedLocalAppData() ? "day" : "profile";
  });
  const [selectedDate, setSelectedDate] = useState<string>(() => getOAuthReturnPending()?.returnDate ?? today);
  const [log, setLog] = useState<LogItem[]>(() => getSavedLog(getOAuthReturnPending()?.returnDate ?? today));
  const [pendingCategory, setPendingCategory] = useState<MealCategory | null>(null);
  const [activeAddFoodTab, setActiveAddFoodTab] = useState<AddFoodTab>("search");
  const [modalQuery, setModalQuery] = useState("");
  const [modalFoods, setModalFoods] = useState<Food[]>([]);
  const [customFoods, setCustomFoods] = useState<Food[]>(() => getSavedCustomFoods());
  const [customQuery, setCustomQuery] = useState("");
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [customFoodForm, setCustomFoodForm] = useState<CustomFoodForm>(emptyCustomFoodForm);
  const [customFoodOcrText, setCustomFoodOcrText] = useState("");
  const [customFoodOcrError, setCustomFoodOcrError] = useState("");
  const [customFoodSaveError, setCustomFoodSaveError] = useState("");
  const [isScanningCustomFood, setIsScanningCustomFood] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>(() => getSavedRecipes());
  const [recipeQuery, setRecipeQuery] = useState("");
  const [isRecipeFormOpen, setIsRecipeFormOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(emptyRecipeForm);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [recipeIngredientQuery, setRecipeIngredientQuery] = useState("");
  const [recipeIngredientFoods, setRecipeIngredientFoods] = useState<Food[]>([]);
  const [isSearchingRecipeIngredients, setIsSearchingRecipeIngredients] = useState(false);
  const [pendingRecipeIngredient, setPendingRecipeIngredient] = useState<Food | null>(null);
  const [pendingRecipeIngredientQuantity, setPendingRecipeIngredientQuantity] = useState("1");
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedFoodDetail, setSelectedFoodDetail] = useState<FoodDetail | null>(null);
  const [selectedPortionValue, setSelectedPortionValue] = useState("");
  const [portionAmount, setPortionAmount] = useState("100");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [itemToRemove, setItemToRemove] = useState<LogItem | null>(null);
  const [foodLibraryTab, setFoodLibraryTab] = useState<FoodLibraryTab>("recent");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySelection, setLibrarySelection] = useState<LibrarySelection | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => getSavedProfile());
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => {
    const savedProfile = getSavedProfile();
    return savedProfile ? profileToForm(savedProfile) : profileFormFromLegacyGoals(getSavedGoals());
  });
  const [goals, setGoals] = useState<Goals | null>(() => {
    const savedProfile = getSavedProfile();
    return savedProfile ? profileToGoals(savedProfile) : getSavedGoals();
  });
  const [profileSaveStatus, setProfileSaveStatus] = useState("");
  const [profileWizardStep, setProfileWizardStep] = useState(0);
  const [isProfileWizardOpen, setIsProfileWizardOpen] = useState(() => !hasSavedLocalAppData());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getSavedThemeMode());
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>(() => getSavedWeightEntries());
  const [weightForm, setWeightForm] = useState<WeightForm>({
    date: today,
    weight: "",
    note: "",
  });
  const [weightSaveError, setWeightSaveError] = useState("");
  const [weightRange, setWeightRange] = useState<WeightRange>("All");
  const [weightChartPointId, setWeightChartPointId] = useState<string | null>(null);
  const [weightEntryToDelete, setWeightEntryToDelete] = useState<WeightEntry | null>(null);
  const [editingWeightEntryId, setEditingWeightEntryId] = useState<string | null>(null);
  const [editingCustomFoodId, setEditingCustomFoodId] = useState<number | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [isCreatingLibraryCustomFood, setIsCreatingLibraryCustomFood] = useState(false);
  const [isCreatingLibraryRecipe, setIsCreatingLibraryRecipe] = useState(false);
  const [libraryCustomFoodForm, setLibraryCustomFoodForm] =
    useState<CustomFoodForm>(emptyCustomFoodForm);
  const [libraryRecipeForm, setLibraryRecipeForm] = useState<RecipeForm>(emptyRecipeForm);
  const [libraryRecipeIngredients, setLibraryRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [completedDays, setCompletedDays] = useState<string[]>(() => getSavedCompletedDays());
  const [showStreakPopup, setShowStreakPopup] = useState(false);
  const [streakPopupDate, setStreakPopupDate] = useState(today);
  const [topFoods, setTopFoods] = useState<TopFoodEntry[]>(() => getSavedTopFoods());
  const [homeSelectedDate, setHomeSelectedDate] = useState<string | null>(null);
  const [goalsView, setGoalsView] = useState<"daily" | "weekly">("weekly");
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [debugLogText, setDebugLogText] = useState("");
  const [debugCopyStatus, setDebugCopyStatus] = useState("");
  const [expandedMeals, setExpandedMeals] = useState<Record<MealCategory, boolean>>({
    Breakfast: true,
    Lunch: true,
    Dinner: true,
    Snacks: true,
  });
  const [mealMenuCategory, setMealMenuCategory] = useState<MealCategory | null>(null);
  const [mealToSaveAsRecipe, setMealToSaveAsRecipe] = useState<MealCategory | null>(null);
  const [mealRecipeName, setMealRecipeName] = useState("");
  const [mealToDelete, setMealToDelete] = useState<MealCategory | null>(null);
  const [contextMenuItem, setContextMenuItem] = useState<LogItem | null>(null);
  const [contextMenuY, setContextMenuY] = useState(0);
  const [moveToMealItem, setMoveToMealItem] = useState<LogItem | null>(null);
  const [moveToDayItem, setMoveToDayItem] = useState<LogItem | null>(null);
  const [moveToDayDate, setMoveToDayDate] = useState("");
  const [moveToDayStep, setMoveToDayStep] = useState<"date" | "meal">("date");
  const [itemToEdit, setItemToEdit] = useState<LogItem | null>(null);
  const [editItemAmount, setEditItemAmount] = useState("1");
  const [editItemAmountUnit, setEditItemAmountUnit] = useState<AmountUnit>("serving");
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("serving");
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportDriveLink, setExportDriveLink] = useState("");
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [driveAccessToken, setDriveAccessToken] = useState<string | null>(null);
  const [googleDriveClientId, setGoogleDriveClientId] = useState(() => getConfiguredGoogleClientId());
  const [importDrafts, setImportDrafts] = useState<FoodLogImportDraft[]>([]);
  const [importWeightEntries, setImportWeightEntries] = useState<WeightImportEntry[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [importSteps, setImportSteps] = useState<ImportDayStep[]>([]);
  const [importStepIndex, setImportStepIndex] = useState(0);
  const [importStepResults, setImportStepResults] = useState({ confirmed: 0, skipped: 0 });
  const [importConfirmedDates, setImportConfirmedDates] = useState<string[]>([]);
  const [importReviewItems, setImportReviewItems] = useState<ImportReviewItem[]>([]);
  const [importReviewSelections, setImportReviewSelections] = useState<Record<string, string>>({});
  const [importReviewAppliedSelections, setImportReviewAppliedSelections] = useState<Record<string, string>>({});
  const [importReviewActions, setImportReviewActions] = useState<Record<string, ImportReviewAction>>({});
  const [expandedImportReviewGroups, setExpandedImportReviewGroups] = useState<Record<string, boolean>>({});
  const [importReviewManualCandidates, setImportReviewManualCandidates] = useState<Record<string, ImportFoodCandidate>>({});
  const [rememberedImportMatches, setRememberedImportMatches] = useState<Record<string, ImportFoodCandidate>>({});
  const [importReviewRememberedRows, setImportReviewRememberedRows] = useState<Record<string, boolean>>({});
  const [importReviewManualTarget, setImportReviewManualTarget] = useState<FoodLogImportDraft | null>(null);
  const [importReviewManualQuery, setImportReviewManualQuery] = useState("");
  const [importReviewManualGroups, setImportReviewManualGroups] = useState<SearchResultGroup[]>([]);
  const [isImportReviewManualSearching, setIsImportReviewManualSearching] = useState(false);
  const [unresolvedImportReviewIds, setUnresolvedImportReviewIds] = useState<string[]>([]);
  const [importResolutionProgress, setImportResolutionProgress] = useState<ImportResolutionProgress | null>(null);
  const [importReviewMode, setImportReviewMode] = useState<ImportReviewMode | null>(null);
  const [isResolvingImport, setIsResolvingImport] = useState(false);
  const [driveImportFiles, setDriveImportFiles] = useState<GoogleDriveFile[]>([]);
  const [driveImportStatus, setDriveImportStatus] = useState("");
  const [isDriveImportOpen, setIsDriveImportOpen] = useState(false);
  const [isLoadingDriveImport, setIsLoadingDriveImport] = useState(false);
  const [isImportDayOpen, setIsImportDayOpen] = useState(false);
  const [isLogMenuOpen, setIsLogMenuOpen] = useState(false);

  useEffect(() => {
    setStorageJson(`log-${selectedDate}`, log);
  }, [log, selectedDate]);

  useEffect(() => {
    appendDebugLog("app-mounted", {
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      serviceWorkerSupported: "serviceWorker" in navigator,
      cacheStorageSupported: "caches" in window,
      localStorageSupported: (() => {
        try {
          const key = "jessicaStorageProbe";
          localStorage.setItem(key, "1");
          localStorage.removeItem(key);
          return true;
        } catch {
          return false;
        }
      })(),
    });

    const handleError = (event: ErrorEvent) => {
      appendDebugLog("window-error", {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      appendDebugLog("unhandled-rejection", {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
      });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => {
          appendDebugLog("service-worker-check", { registrations: registrations.length });
          for (const registration of registrations) {
            registration
              .unregister()
              .then((unregistered) => {
                appendDebugLog("service-worker-unregister", {
                  scope: registration.scope,
                  unregistered,
                });
              })
              .catch((error) => {
                appendDebugLog("service-worker-unregister-failed", {
                  scope: registration.scope,
                  message: error instanceof Error ? error.message : String(error),
                });
              });
          }
        })
        .catch((error) => {
          appendDebugLog("service-worker-check-failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        });
    }

    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => {
          appendDebugLog("cache-storage-check", { keys });
          return Promise.all(
            keys.map((key) =>
              caches
                .delete(key)
                .then((deleted) => appendDebugLog("cache-storage-delete", { key, deleted }))
            )
          );
        })
        .catch((error) => {
          appendDebugLog("cache-storage-check-failed", {
            message: error instanceof Error ? error.message : String(error),
          });
        });
    }

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    saveCustomFoods(customFoods);
  }, [customFoods]);

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  useEffect(() => {
    saveWeightEntries(weightEntries);
  }, [weightEntries]);

  useEffect(() => { saveCompletedDays(completedDays); }, [completedDays]);
  useEffect(() => { saveTopFoods(topFoods); }, [topFoods]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    localStorage.setItem(themeStorageKey, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes("access_token=")) return;
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get("access_token");
    if (!token) return;
    window.history.replaceState(null, "", window.location.origin + window.location.pathname + window.location.search);
    const pendingRaw = localStorage.getItem(oauthPendingActionKey);
    localStorage.removeItem(oauthPendingActionKey);

    queueMicrotask(() => {
      setDriveAccessToken(token);
      if (!pendingRaw) return;

      try {
        const pending = JSON.parse(pendingRaw) as OAuthPendingAction;
        if (Date.now() - pending.timestamp > 10 * 60 * 1000) return;
        setGoogleDriveClientId(pending.clientId);
        resumePendingOAuthAction(pending, token);
      } catch (error) {
        appendDebugLog("oauth-pending-action-parse-failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function changeSelectedDate(date: string) {
    setSelectedDate(date);
    setLog(getSavedLog(date));
  }

  function toggleHomeDate(date: string) {
    if (homeSelectedDate === date) {
      setHomeSelectedDate(null);
      return;
    }

    setHomeSelectedDate(date);
    changeSelectedDate(date);
  }

  function moveSelectedDate(dayOffset: number) {
    changeSelectedDate(shiftDate(selectedDate, dayOffset));
  }

  function markDayComplete() {
    if (completedDays.includes(selectedDate)) return;
    setCompletedDays((prev) => [...prev, selectedDate]);
    setStreakPopupDate(selectedDate);
    setShowStreakPopup(true);
  }

  function handleFinishToggle() {
    if (completedDays.includes(selectedDate)) {
      reopenDayLogging();
    } else {
      markDayComplete();
    }
  }

  function reopenDayLogging() {
    setCompletedDays((prev) => prev.filter((date) => date !== selectedDate));
    setShowStreakPopup(false);
  }

  function getCompletedStreak(referenceDate = today, days = completedDays): number {
    const set = new Set(days);
    let streak = 0;
    let d = referenceDate;
    for (let i = 0; i < 365; i++) {
      if (!set.has(d)) break;
      streak++;
      d = shiftDate(d, -1);
    }
    return streak;
  }

  function getItemCalories(item: LogItem) {
    return Math.round(item.calories * item.quantity);
  }

  const dailyTotals = log.reduce(
    (totals, item) => ({
      calories: totals.calories + getItemCalories(item),
      protein: totals.protein + item.protein * item.quantity,
      carbs: totals.carbs + item.carbs * item.quantity,
      fat: totals.fat + item.fat * item.quantity,
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    }
  );
  const totalCalories = dailyTotals.calories;

  function getCategoryTotals(category: MealCategory) {
    return log
      .filter((item) => item.category === category)
      .reduce(
        (totals, item) => ({
          calories: totals.calories + getItemCalories(item),
          protein: totals.protein + item.protein * item.quantity,
          carbs: totals.carbs + item.carbs * item.quantity,
          fat: totals.fat + item.fat * item.quantity,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
  }

  function toggleMeal(category: MealCategory) {
    setExpandedMeals((current) => ({ ...current, [category]: !current[category] }));
  }

  function scrollToMeal(category: MealCategory) {
    setExpandedMeals((current) => ({ ...current, [category]: true }));
    window.requestAnimationFrame(() => {
      mealCardRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function openAddFood(category: MealCategory) {
    setPendingCategory(category);
    setActiveAddFoodTab("search");
    setModalQuery("");
    setModalFoods([]);
    setCustomQuery("");
    setIsCustomFormOpen(false);
    setCustomFoodForm(emptyCustomFoodForm);
    setCustomFoodOcrText("");
    setCustomFoodOcrError("");
    setCustomFoodSaveError("");
    setIsScanningCustomFood(false);
    setRecipeQuery("");
    setIsRecipeFormOpen(false);
    setRecipeForm(emptyRecipeForm);
    setRecipeIngredients([]);
    setRecipeIngredientQuery("");
    setRecipeIngredientFoods([]);
    setIsSearchingRecipeIngredients(false);
    setPendingRecipeIngredient(null);
    setPendingRecipeIngredientQuantity("1");
    setSelectedFood(null);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount("100");
    setIsLoadingDetail(false);
    setDetailError("");
    setQuantity("1");
  }

  function closeAddFood() {
    setPendingCategory(null);
    setActiveAddFoodTab("search");
    setSelectedFood(null);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount("100");
    setDetailError("");
    setIsCustomFormOpen(false);
    setCustomFoodOcrText("");
    setCustomFoodOcrError("");
    setCustomFoodSaveError("");
    setIsScanningCustomFood(false);
    setIsRecipeFormOpen(false);
  }

  async function searchModalFood() {
    if (!modalQuery.trim()) return;

    const groups = await searchFoodsGrouped(modalQuery, customFoods, getRecentFoods(selectedDate), recipes);
    const foodsById = new Map<number, Food>();
    for (const group of groups) {
      for (const food of group.foods) {
        if (!foodsById.has(food.id)) foodsById.set(food.id, food);
      }
    }
    setModalFoods([...foodsById.values()]);
  }

  async function selectFood(food: Food) {
    const measuredBasis = getMeasuredServingBasis(food);
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(measuredBasis?.amount ?? parseServingSize(food.servingSize)?.amount ?? 1));
    setAmountUnit(measuredBasis?.unit ?? "serving");
    setDetailError("");

    if (!food.isSearchPreview && hasUsableSearchNutrition(food)) {
      setIsLoadingDetail(false);
      return;
    }

    try {
      setIsLoadingDetail(true);
      const detail = await fetchUsdaFoodDetail(food.id);
      const detailFood = getFoodForSelectedPortion(food, detail, undefined, 1);
      const detailBasis = getMeasuredServingBasis(detailFood);
      const portions = getPortionOptions(detail, detailFood.name);

      setSelectedFood(detailFood);
      setSelectedFoodDetail(detail);
      setPortionAmount(String(detailBasis?.amount ?? parseServingSize(detailFood.servingSize)?.amount ?? 1));
      setAmountUnit(detailBasis?.unit ?? "serving");
      setSelectedPortionValue(portions[0]?.value ?? "");
    } catch {
      setDetailError("Could not load portion details for this food.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function selectLocalFood(food: Food) {
    const measuredBasis = getMeasuredServingBasis(food);
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(measuredBasis?.amount ?? parseServingSize(food.servingSize)?.amount ?? 1));
    setAmountUnit(measuredBasis?.unit ?? "serving");
    setDetailError("");
    setIsLoadingDetail(false);
  }

  function openCustomFoodForm() {
    setSelectedFood(null);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount("100");
    setAmountUnit("serving");
    setDetailError("");
    setQuantity("1");
    setCustomFoodOcrText("");
    setCustomFoodOcrError("");
    setCustomFoodSaveError("");
    setIsCustomFormOpen(true);
  }

  function openRecipeForm() {
    setSelectedFood(null);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount("100");
    setDetailError("");
    setQuantity("1");
    setRecipeForm(emptyRecipeForm);
    setRecipeIngredients([]);
    setRecipeIngredientQuery("");
    setRecipeIngredientFoods([]);
    setPendingRecipeIngredient(null);
    setPendingRecipeIngredientQuantity("1");
    setIsRecipeFormOpen(true);
  }

  function createCustomFood() {
    setCustomFoodSaveError("");
    appendDebugLog("custom-food-save-click", {
      name: customFoodForm.name.trim(),
      servingSize: customFoodForm.servingSize,
      servingUnit: customFoodForm.servingUnit,
      calories: customFoodForm.calories,
      protein: customFoodForm.protein,
      carbs: customFoodForm.carbs,
      fat: customFoodForm.fat,
    });

    const customFood = parseCustomFood(customFoodForm);
    if (!customFood) {
      const message = "Could not save food. Check name, serving size, serving unit, calories, and macro numbers.";
      setCustomFoodSaveError(message);
      appendDebugLog("custom-food-save-invalid", { form: customFoodForm });
      return;
    }

    const nextCustomFoods = [customFood, ...customFoods];
    const storageOk = setStorageJson("customFoods", nextCustomFoods);
    const verified = verifyStorageCount("customFoods", nextCustomFoods.length);

    if (!storageOk || !verified) {
      const message = "Food was created in memory, but this browser did not confirm it was saved.";
      setCustomFoodSaveError(message);
      appendDebugLog("custom-food-save-not-persisted", { storageOk, verified });
      setCustomFoods(nextCustomFoods);
      return;
    }

    setCustomFoods(nextCustomFoods);
    setCustomFoodForm(emptyCustomFoodForm);
    setCustomFoodOcrText("");
    setCustomFoodOcrError("");
    setCustomFoodSaveError("");
    setIsCustomFormOpen(false);
    setActiveAddFoodTab("custom");
    selectLocalFood(customFood);
    appendDebugLog("custom-food-save-success", {
      id: customFood.id,
      name: customFood.name,
      count: nextCustomFoods.length,
      persisted: storageOk && verified,
    });
  }

  async function scanCustomFoodLabel(file: File | undefined) {
    if (!file) {
      setCustomFoodOcrError("No image was selected.");
      appendDebugLog("scan-no-file");
      return;
    }

    setCustomFoodOcrError("");
    setIsScanningCustomFood(true);
    appendDebugLog("scan-start", {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    });

    try {
      const result = await recognize(file, "eng");
      const text = normalizeOcrText(result.data.text);
      const scannedFields = parseNutritionLabelText(text);
      const nextForm = { ...customFoodForm };

      for (const [key, value] of Object.entries(scannedFields) as [keyof ScannedNutritionFields, string][]) {
        if (value) nextForm[key] = value;
      }

      setCustomFoodForm(nextForm);
      setCustomFoodOcrText(text);

      if (!Object.values(scannedFields).some(Boolean)) {
        setCustomFoodOcrError("OCR finished, but no nutrition fields were recognized. You can still enter them manually.");
      }
      appendDebugLog("scan-finished", {
        recognizedFields: Object.entries(scannedFields).filter(([, value]) => Boolean(value)).map(([key]) => key),
        textLength: text.length,
      });
    } catch (error) {
      setCustomFoodOcrError("Could not scan that image. Try a clearer photo or enter the values manually.");
      appendDebugLog("scan-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsScanningCustomFood(false);
      if (customFoodScanInputRef.current) customFoodScanInputRef.current.value = "";
    }
  }

  async function selectRecipeIngredient(food: Food) {
    if (!food.isSearchPreview) {
      setPendingRecipeIngredient(food);
      setPendingRecipeIngredientQuantity("1");
      return;
    }

    try {
      const detail = await fetchUsdaFoodDetail(food.id);
      setPendingRecipeIngredient(getFoodForSelectedPortion(food, detail, undefined, 1));
      setPendingRecipeIngredientQuantity("1");
    } catch {
      setPendingRecipeIngredient(null);
    }
  }

  function confirmRecipeIngredient() {
    if (!pendingRecipeIngredient) return;

    const quantity = Number(pendingRecipeIngredientQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    const existingIngredient = recipeIngredients.find(
      (ingredient) => ingredient.food.id === pendingRecipeIngredient.id
    );

    if (existingIngredient) {
      setRecipeIngredients(
        recipeIngredients.map((ingredient) =>
          ingredient.food.id === pendingRecipeIngredient.id
            ? { ...ingredient, quantity: ingredient.quantity + quantity }
            : ingredient
        )
      );
      setPendingRecipeIngredient(null);
      setPendingRecipeIngredientQuantity("1");
      return;
    }

    setRecipeIngredients([...recipeIngredients, { food: pendingRecipeIngredient, quantity }]);
    setPendingRecipeIngredient(null);
    setPendingRecipeIngredientQuantity("1");
  }

  async function searchRecipeIngredientFoods() {
    if (!recipeIngredientQuery.trim()) {
      setRecipeIngredientFoods([]);
      return;
    }

    setIsSearchingRecipeIngredients(true);

    try {
      setRecipeIngredientFoods(await searchUsdaFoodsWithSynonyms(recipeIngredientQuery));
    } finally {
      setIsSearchingRecipeIngredients(false);
    }
  }

  function updateRecipeIngredientQuantity(foodId: number, quantity: string) {
    const parsedQuantity = Number(quantity);

    setRecipeIngredients(
      recipeIngredients.map((ingredient) =>
        ingredient.food.id === foodId
          ? {
              ...ingredient,
              quantity:
                Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : ingredient.quantity,
            }
          : ingredient
      )
    );
  }

  function removeRecipeIngredient(foodId: number) {
    setRecipeIngredients(recipeIngredients.filter((ingredient) => ingredient.food.id !== foodId));
  }

  function createRecipe() {
    const recipe = parseRecipe(recipeForm, recipeIngredients);
    if (!recipe) return;

    setRecipes([recipe, ...recipes]);
    setRecipeForm(emptyRecipeForm);
    setRecipeIngredients([]);
    setRecipeIngredientQuery("");
    setIsRecipeFormOpen(false);
    setActiveAddFoodTab("recipes");
    selectLocalFood(recipe);
  }

  function addSelectedFood() {
    if (!selectedFood || !pendingCategory) return;
    if (selectedFood.isSearchPreview) return;

    const servings = hasUsableSearchNutrition(selectedFood) ? 1 : Number(quantity);
    const amount = Number(portionAmount);
    const measuredBasis = getMeasuredServingBasis(selectedFood);
    const basisAmount =
      measuredBasis && amountUnit !== "serving" && Number.isFinite(amount) && amount > 0
        ? convertAmountToBasisUnit(amount, amountUnit, measuredBasis.unit)
        : null;
    const amountScale =
      selectedFood && amountUnit !== "serving" && basisAmount !== null
        ? getScaleFromServingBasis(selectedFood, basisAmount)
        : null;
    const selectedServings = amountUnit === "serving" ? servings : 1;
    if (!Number.isFinite(selectedServings) || selectedServings <= 0) return;
    if (amountUnit !== "serving" && amountScale === null) return;

    const portionOptions = getPortionOptions(selectedFoodDetail, selectedFood.name);
    const selectedPortion = portionOptions.find((portion) => portion.value === selectedPortionValue);
    const selectedFoodServing = getFoodForSelectedPortion(
      selectedFood,
      selectedFoodDetail,
      selectedPortion,
      amountUnit !== "serving" && amountScale !== null
        ? basisAmount ?? amount
        : Number(portionAmount)
    );
    const displayFoodServing = {
      ...selectedFoodServing,
      name: getFoodDisplayName(selectedFoodServing),
      brand: selectedFoodServing.brand ? getBrandDisplayName(selectedFoodServing.brand) : selectedFoodServing.brand,
    };
    const servingLabel =
      amountUnit === "serving"
        ? selectedPortion
          ? selectedServings === 1
            ? selectedPortion.label
            : `${selectedServings} x ${selectedPortion.label}`
          : selectedServings === 1
          ? selectedFoodServing.servingSize
          : `${selectedServings} x ${selectedFoodServing.servingSize}`
        : `${amount} ${amountUnit}`;

    setLog([
      ...log,
      {
        ...displayFoodServing,
        category: pendingCategory,
        quantity: selectedServings,
        amount: amountUnit === "serving" ? selectedServings : amount,
        amountUnit,
        portionLabel: selectedPortion?.label,
        portionScale: selectedPortion
          ? getScaleFromServingBasis(selectedFood, selectedPortion.gramWeight) ?? undefined
          : amountScale ?? undefined,
        servingLabel,
        logId: createClientId(),
      },
    ]);

    const foodName = displayFoodServing.name;
    setTopFoods((prev) => {
      const existing = prev.find((f) => f.name === foodName);
      const updated = existing
        ? prev.map((f) => f.name === foodName ? { ...f, count: f.count + 1 } : f)
        : [...prev, { name: foodName, count: 1 }];
      return updated.sort((a, b) => b.count - a.count).slice(0, 10);
    });

    closeAddFood();
  }

  function removeFood(logId: string) {
    setLog(log.filter((item) => item.logId !== logId));
  }

  function confirmRemoveFood() {
    if (!itemToRemove) return;

    removeFood(itemToRemove.logId);
    setItemToRemove(null);
  }

  function moveItemToMeal(item: LogItem, targetCategory: MealCategory) {
    setLog(log.map((i) => (i.logId === item.logId ? { ...i, category: targetCategory } : i)));
    setMoveToMealItem(null);
  }

  function moveItemToDifferentDay(item: LogItem, targetDate: string, targetCategory: MealCategory) {
    setLog(log.filter((i) => i.logId !== item.logId));
    const targetLog = getSavedLog(targetDate);
    setStorageJson(`log-${targetDate}`, [...targetLog, { ...item, category: targetCategory, logId: createClientId() }]);
    setMoveToDayItem(null);
    setMoveToDayDate("");
    setMoveToDayStep("date");
  }

  function formatAmountLabel(amount: number) {
    return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
  }

  function getEditAmountUnits(item: LogItem | null) {
    if (!item) return ["serving"] as AmountUnit[];

    const units: AmountUnit[] =
      item.measurementType === "liquid"
        ? ["ml", "cup", "tbsp", "tsp", "serving"]
        : item.measurementType === "spoonable"
        ? ["g", "oz", "tbsp", "tsp", "serving"]
        : ["g", "oz", "serving"];

    if (item.amountUnit && !units.includes(item.amountUnit)) units.unshift(item.amountUnit);

    return units;
  }

  function openEditFoodItem(item: LogItem) {
    setItemToEdit(item);
    setEditItemAmount(String(item.amount ?? item.quantity ?? 1));
    setEditItemAmountUnit(item.amountUnit ?? "serving");
  }

  function saveEditedFoodItem() {
    if (!itemToEdit) return;

    const amount = parseDecimalInput(editItemAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const amountLabel = formatAmountLabel(amount);

    setLog(
      log.map((item) =>
        item.logId === itemToEdit.logId
          ? (() => {
              if (editItemAmountUnit === "serving") {
                const servingName = item.portionLabel ?? item.servingSize;
                return {
                  ...item,
                  quantity: amount,
                  amount,
                  amountUnit: editItemAmountUnit,
                  servingLabel: amount === 1 ? servingName : `${amountLabel} x ${servingName}`,
                };
              }

              const measuredBasis = getMeasuredServingBasis(item);
              if (!measuredBasis) return item;

              const basisAmount = convertAmountToBasisUnit(amount, editItemAmountUnit, measuredBasis.unit);
              if (basisAmount === null) return item;

              const amountScale = getScaleFromServingBasis(item, basisAmount);
              if (amountScale === null) return item;

              const nextServingSize = `${formatAmountLabel(basisAmount)} ${measuredBasis.unit}`;
              const nextItem = scaleFoodNutrition(item, amountScale, nextServingSize);

              return {
                ...item,
                ...nextItem,
                category: item.category,
                logId: item.logId,
                quantity: 1,
                amount,
                amountUnit: editItemAmountUnit,
                portionScale:
                  item.portionScale !== undefined && Number.isFinite(item.portionScale)
                    ? item.portionScale * amountScale
                    : item.portionScale,
                servingLabel: `${amountLabel} ${editItemAmountUnit}`,
              };
            })()
          : item
      )
    );
    setItemToEdit(null);
  }

  function getMealItems(category: MealCategory) {
    return log.filter((item) => item.category === category);
  }

  function openSaveMealAsRecipe(category: MealCategory) {
    setMealMenuCategory(null);
    setMealToSaveAsRecipe(category);
    setMealRecipeName(`${category} ${formatShortDate(selectedDate)}`);
  }

  function saveMealAsRecipe() {
    if (!mealToSaveAsRecipe) return;

    const mealItems = getMealItems(mealToSaveAsRecipe);
    const recipe = parseRecipe(
      {
        name: mealRecipeName,
        servingSize: "1",
        servingUnit: "meal",
        notes: `Saved from ${mealToSaveAsRecipe} on ${selectedDate}`,
      },
      mealItems.map((item) => ({ food: item, quantity: item.quantity }))
    );

    if (!recipe) return;

    setRecipes([recipe, ...recipes]);
    setMealToSaveAsRecipe(null);
    setMealRecipeName("");
  }

  function confirmDeleteMeal() {
    if (!mealToDelete) return;

    setLog(log.filter((item) => item.category !== mealToDelete));
    setMealToDelete(null);
    setMealMenuCategory(null);
  }

  async function readFoodLogImport(file: File | undefined) {
    setImportStatus("");
    setImportErrors([]);
    setImportFileName(file?.name ?? "");

    if (!file) return;

    try {
      await loadFoodLogImportText(await file.text(), file.name);
    } catch (error) {
      setImportDrafts([]);
      setImportErrors([`Could not read JSON: ${error instanceof Error ? error.message : String(error)}`]);
    }
  }

  function openImportFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = () => readFoodLogImport(input.files?.[0]);
    input.click();
  }

  async function loadFoodLogImportText(text: string, fileName: string) {
    try {
      importCandidateCache.clear();
      importUsdaCandidateCache.clear();
      const parsed = JSON.parse(text) as unknown;
      const result = parseFoodLogImportJson(parsed);

      setImportFileName(fileName);
      setImportStatus("");
      setImportReviewItems([]);
      setImportReviewSelections({});
      setImportReviewAppliedSelections({});
      setImportReviewActions({});
      setExpandedImportReviewGroups({});
      setImportReviewManualCandidates({});
      setRememberedImportMatches({});
      setImportReviewRememberedRows({});
      setImportReviewManualTarget(null);
      setImportReviewManualQuery("");
      setImportReviewManualGroups([]);
      setUnresolvedImportReviewIds([]);
      setImportResolutionProgress(null);

      if (result.ok === false) {
        setImportDrafts([]);
        setImportErrors(result.errors);
        importFoodBatchResolverRef.current = null;
        return;
      }

      setImportErrors([]);
      importFoodBatchResolverRef.current = null;
      setImportSteps([]);
      setImportStepIndex(0);
      setImportStepResults({ confirmed: 0, skipped: 0 });
      setImportConfirmedDates([]);
      setImportDrafts(result.items);
      setImportWeightEntries(result.weightEntries);

      const validationErrors = result.items.flatMap((item, index) => validateImportDraft(item, index));
      if (validationErrors.length > 0) {
        setImportErrors(validationErrors);
        return;
      }

      if (result.items.length === 0) {
        setImportStatus("No food items were found in this import.");
        return;
      }

      setIsResolvingImport(true);
      setImportResolutionProgress({ resolved: 0, total: result.items.length });
      try {
        const batch = await buildImportFoodBatchResolver(result.items, customFoods, recipes, {}, {
          forceReviewAll: true,
          onProgress: setImportResolutionProgress,
        });
        primeImportReview(batch.reviewItems, "preview");
      } catch (error) {
        appendDebugLog("import-file-resolution-failed", {
          message: error instanceof Error ? error.message : String(error),
        });
        setImportErrors([`Could not resolve food matches: ${error instanceof Error ? error.message : String(error)}`]);
      } finally {
        setIsResolvingImport(false);
        setImportResolutionProgress(null);
      }
    } catch (error) {
      setImportDrafts([]);
      setImportErrors([`Could not read JSON: ${error instanceof Error ? error.message : String(error)}`]);
      setIsResolvingImport(false);
      setImportResolutionProgress(null);
    }
  }

  function updateImportDraft(id: string, updates: Partial<FoodLogImportDraft>) {
    setImportDrafts((current) =>
      current.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    setImportErrors([]);
  }

  function removeImportDraft(id: string) {
    setImportDrafts((current) => current.filter((item) => item.id !== id));
    setImportErrors([]);
  }

  function removeImportWeightEntry(id: string) {
    setImportWeightEntries((current) => current.filter((entry) => entry.id !== id));
    setImportErrors([]);
  }

  function closeImportPreview() {
    setImportDrafts([]);
    setImportWeightEntries([]);
    setImportErrors([]);
    setImportFileName("");
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportResolutionProgress(null);
    setImportReviewMode(null);
    importFoodBatchResolverRef.current = null;
  }

  function clearImportStepper() {
    setImportSteps([]);
    setImportStepIndex(0);
    setImportStepResults({ confirmed: 0, skipped: 0 });
    setImportConfirmedDates([]);
    setImportFileName("");
    setImportErrors([]);
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportResolutionProgress(null);
    setImportReviewMode(null);
    importFoodBatchResolverRef.current = null;
  }

  function getResolvedImportedFoods(items: FoodLogImportDraft[], resolver: ImportFoodBatchResolver) {
    return items.map((item) => {
      const resolved = resolver.byDraftId.get(item.id) ?? buildImportFoodFromDraft(item, -Date.now());
      return {
        date: item.date,
        meal: normalizeMealName(item.meal),
        food: resolved.food,
        quantity: resolved.quantity,
        importAudit: resolved.importAudit,
      };
    });
  }

  function applyImportedFoods(importedFoods: ReturnType<typeof getResolvedImportedFoods>) {
    const newCustomFoods = Array.from(
      new Map(
        importedFoods
          .map((entry) => entry.food)
          .filter((food) =>
            food.id < 0 &&
            !customFoods.some((existing) => existing.id === food.id)
          )
          .map((food) => [food.id, food])
      ).values()
    );
    const { foods: dedupedCustomFoods, foodRemap } = dedupeCustomFoods([...newCustomFoods, ...customFoods]);
    const nextLogsByDate = new Map<string, LogItem[]>();

    for (const entry of importedFoods) {
      const existingLog = nextLogsByDate.get(entry.date) ?? (entry.date === selectedDate ? log : getSavedLog(entry.date));
      nextLogsByDate.set(entry.date, [
        ...existingLog,
        {
          ...entry.food,
          logId: createClientId(),
          category: entry.meal,
          quantity: entry.quantity,
          importAudit: entry.importAudit,
        },
      ]);
    }

    for (const [date, nextLog] of nextLogsByDate) {
      setStorageJson(`log-${date}`, remapLogFoodIds(nextLog, foodRemap));
    }
    remapSavedLogFoodIds(foodRemap);
    setCustomFoods(dedupedCustomFoods);
    setTopFoods((current) => {
      const counts = new Map(current.map((food) => [food.name, food.count]));
      importedFoods.forEach((entry) => {
        counts.set(entry.food.name, (counts.get(entry.food.name) ?? 0) + 1);
      });

      return Array.from(counts, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });

    return { nextLogsByDate, foodRemap };
  }

  function primeImportReview(reviewItems: ImportReviewItem[], mode: ImportReviewMode) {
    const nextManualCandidates: Record<string, ImportFoodCandidate> = {};
    const nextRememberedRows: Record<string, boolean> = {};
    const nextReviewItems = reviewItems.map((review) => {
      const remembered = rememberedImportMatches[normalizeImportName(review.item.name)];
      if (!remembered) return review;

      const candidate = buildManualImportCandidate(review.item, remembered.food);
      nextManualCandidates[review.item.id] = candidate;
      nextRememberedRows[review.item.id] = true;
      return {
        ...review,
        candidates: [
          candidate,
          ...review.candidates.filter((existing) => existing.key !== candidate.key),
        ],
      };
    });

    setImportReviewItems(nextReviewItems);
    setImportReviewSelections(Object.fromEntries(
      nextReviewItems.map((review) => [review.item.id, nextManualCandidates[review.item.id]?.key ?? getDefaultImportReviewSelection(review)])
    ));
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates(nextManualCandidates);
    setImportReviewRememberedRows(nextRememberedRows);
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportReviewMode(mode);
    setImportStatus(`${reviewItems.length} imported food${reviewItems.length === 1 ? "" : "s"} need match review.`);
  }

  async function confirmImportStep() {
    const step = importSteps[importStepIndex];
    if (!step) return;

    if (step.items.length > 0) {
      if (!importFoodBatchResolverRef.current) {
        setIsResolvingImport(true);
        try {
          const result = await buildImportFoodBatchResolver(importSteps.flatMap((s) => s.items), customFoods, recipes);
          if (result.reviewItems.length > 0) {
            primeImportReview(result.reviewItems, "step");
            return;
          }
          importFoodBatchResolverRef.current = result.resolver;
        } catch (error) {
          appendDebugLog("import-step-resolution-failed", {
            message: error instanceof Error ? error.message : String(error),
          });
          setImportErrors([`Could not resolve food matches: ${error instanceof Error ? error.message : String(error)}`]);
          return;
        } finally {
          setIsResolvingImport(false);
        }
      }

      const resolver = importFoodBatchResolverRef.current;
      const { nextLogsByDate, foodRemap } = applyImportedFoods(getResolvedImportedFoods(step.items, resolver));
      if (step.date === selectedDate) setLog(remapLogFoodIds(nextLogsByDate.get(step.date) ?? getSavedLog(step.date), foodRemap));
    }

    if (step.weightEntry) {
      setWeightEntries((current) => [
        ...current,
        { id: createClientId(), date: step.weightEntry!.date, weight: step.weightEntry!.weightLb, unit: "lb" as const },
      ]);
    }

    setImportStepResults((prev) => ({ ...prev, confirmed: prev.confirmed + 1 }));
    setImportConfirmedDates((prev) => [...prev, step.date]);
    setImportStepIndex((prev) => prev + 1);
  }

  function skipImportStep() {
    setImportStepResults((prev) => ({ ...prev, skipped: prev.skipped + 1 }));
    setImportStepIndex((prev) => prev + 1);
  }

  function cancelImportStepper() {
    const { confirmed } = importStepResults;
    if (confirmed > 0) {
      const firstDate = importConfirmedDates[0];
      if (firstDate) {
        setSelectedDate(firstDate);
        setLog(getSavedLog(firstDate));
      }
      setImportStatus(`Imported ${confirmed} of ${importSteps.length} day${importSteps.length === 1 ? "" : "s"}.`);
    }
    clearImportStepper();
  }

  function closeImportSummary() {
    const firstDate = importConfirmedDates[0];
    if (firstDate) {
      setSelectedDate(firstDate);
      setLog(getSavedLog(firstDate));
    }
    const { confirmed, skipped } = importStepResults;
    const parts: string[] = [];
    if (confirmed > 0) parts.push(`${confirmed} day${confirmed === 1 ? "" : "s"} imported`);
    if (skipped > 0) parts.push(`${skipped} skipped`);
    if (parts.length > 0) setImportStatus(parts.join(", ") + ".");
    clearImportStepper();
  }

  async function confirmFoodLogImport() {
    const validationErrors = importDrafts.flatMap((item, index) => validateImportDraft(item, index));
    if (validationErrors.length > 0) {
      setImportErrors(validationErrors);
      return;
    }

    setIsResolvingImport(true);
    try {
      const result = await buildImportFoodBatchResolver(importDrafts, customFoods, recipes);
      if (result.reviewItems.length > 0) {
        primeImportReview(result.reviewItems, "preview");
        return;
      }
      importFoodBatchResolverRef.current = result.resolver;
      finalizeFoodLogImport(result.resolver);
    } catch (error) {
      appendDebugLog("import-preview-resolution-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setImportErrors([`Could not resolve food matches: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setIsResolvingImport(false);
    }
  }

  function finalizeFoodLogImport(resolver: ImportFoodBatchResolver, items: FoodLogImportDraft[] = importDrafts) {
    const importedFoods = getResolvedImportedFoods(items, resolver);
    const { nextLogsByDate, foodRemap } = applyImportedFoods(importedFoods);

    const firstDate = importedFoods[0]?.date ?? selectedDate;
    if (nextLogsByDate.has(firstDate)) {
      setSelectedDate(firstDate);
      setLog(remapLogFoodIds(nextLogsByDate.get(firstDate) ?? getSavedLog(firstDate), foodRemap));
    }

    if (importWeightEntries.length > 0) {
      const newWeightEntries: WeightEntry[] = importWeightEntries.map((entry) => ({
        id: createClientId(),
        date: entry.date,
        weight: entry.weightLb,
        unit: "lb" as const,
      }));
      setWeightEntries((current) => [...current, ...newWeightEntries]);
    }

    const parts: string[] = [];
    if (importedFoods.length > 0) parts.push(`${importedFoods.length} food${importedFoods.length === 1 ? "" : "s"}`);
    if (importWeightEntries.length > 0) parts.push(`${importWeightEntries.length} weight entr${importWeightEntries.length === 1 ? "y" : "ies"}`);
    setImportStatus(parts.length > 0 ? `Imported ${parts.join(" and ")}.` : "No food items were imported.");
    closeImportPreview();
  }

  async function confirmImportReview() {
    const items = importReviewMode === "step" ? importSteps.flatMap((step) => step.items) : importDrafts;
    const unresolvedIds = importReviewItems
      .map((review) => review.item.id)
      .filter((id) => !importReviewActions[id]);

    if (unresolvedIds.length > 0) {
      setUnresolvedImportReviewIds(unresolvedIds);
      setImportErrors([`Resolve all imported foods before confirming. ${unresolvedIds.length} row${unresolvedIds.length === 1 ? "" : "s"} still need Apply or Reject.`]);
      window.setTimeout(() => {
        document.querySelector(".import-review-row.is-unresolved")?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
      return;
    }

    const rejectedIds = new Set(
      Object.entries(importReviewActions)
        .filter(([, action]) => action === "rejected")
        .map(([id]) => id)
    );
    const appliedItems = items.filter((item) => !rejectedIds.has(item.id));
    const appliedSelections = Object.fromEntries(
      appliedItems.map((item) => [item.id, importReviewAppliedSelections[item.id] ?? importReviewSelections[item.id] ?? "new"])
    );

    setIsResolvingImport(true);
    try {
      const result = await buildImportFoodBatchResolver(appliedItems, customFoods, recipes, appliedSelections, {
        manualCandidates: importReviewManualCandidates,
      });
      if (result.reviewItems.length > 0) {
        primeImportReview(result.reviewItems, importReviewMode ?? "preview");
        return;
      }
      importFoodBatchResolverRef.current = result.resolver;
      setImportReviewItems([]);
      setImportReviewSelections({});
      setImportReviewAppliedSelections({});
      setImportReviewActions({});
      setExpandedImportReviewGroups({});
      setImportReviewManualCandidates({});
      setRememberedImportMatches({});
      setImportReviewRememberedRows({});
      setImportReviewManualTarget(null);
      setImportReviewManualQuery("");
      setImportReviewManualGroups([]);
      setUnresolvedImportReviewIds([]);
      setImportReviewMode(null);
      finalizeFoodLogImport(result.resolver, appliedItems);
    } catch (error) {
      appendDebugLog("import-review-resolution-failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setImportErrors([`Could not resolve reviewed matches: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setIsResolvingImport(false);
    }
  }

  function updateImportReviewSelection(itemId: string, value: string) {
    const item = importReviewItems.find((review) => review.item.id === itemId)?.item;
    const groupItems = item ? getImportReviewGroupItems(item) : [];
    const groupIds = groupItems.length > 0 ? groupItems.map((groupItem) => groupItem.id) : [itemId];
    const groupUpdates = Object.fromEntries(groupIds.map((id) => [id, value]));

    setImportReviewSelections((current) => ({ ...current, ...groupUpdates }));
    setImportReviewAppliedSelections((current) => {
      const next = { ...current };
      groupIds.forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewActions((current) => {
      const next = { ...current };
      groupIds.forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      groupIds.forEach((id) => delete next[id]);
      return next;
    });
    if (item) setExpandedImportReviewGroups((current) => ({ ...current, [getImportReviewGroupKey(item)]: true }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !groupIds.includes(id)));
    setImportErrors([]);
  }

  function getImportReviewCandidateForSelection(item: FoodLogImportDraft, selected: string) {
    const review = importReviewItems.find((reviewItem) => reviewItem.item.id === item.id);
    return review?.candidates.find((candidate) => candidate.key === selected) ??
      (importReviewManualCandidates[item.id]?.key === selected ? importReviewManualCandidates[item.id] : null);
  }

  function getImportReviewGroupKey(item: FoodLogImportDraft) {
    return normalizeImportName(item.name);
  }

  function getImportReviewGroupItems(item: FoodLogImportDraft) {
    const groupKey = getImportReviewGroupKey(item);
    return importReviewItems
      .map((review) => review.item)
      .filter((reviewItem) => getImportReviewGroupKey(reviewItem) === groupKey);
  }

  function expandImportReviewGroup(item: FoodLogImportDraft) {
    setExpandedImportReviewGroups((current) => ({ ...current, [getImportReviewGroupKey(item)]: true }));
  }

  function applyImportReviewToSimilar(item: FoodLogImportDraft) {
    const selected = importReviewSelections[item.id] ?? "new";
    const selectedCandidate = selected === "new" ? null : getImportReviewCandidateForSelection(item, selected);
    const rememberedKey = normalizeImportName(item.name);
    const candidatesById: Record<string, ImportFoodCandidate> = {};
    const groupItems = getImportReviewGroupItems(item);
    const selectionById: Record<string, string> = {};
    const appliedById: Record<string, string> = {};
    const actionById: Record<string, ImportReviewAction> = {};
    const rememberedRowsById: Record<string, boolean> = {};

    for (const groupItem of groupItems) {
      actionById[groupItem.id] = "applied";

      if (selectedCandidate && groupItem.id !== item.id) {
        const candidate = buildManualImportCandidate(groupItem, selectedCandidate.food);
        candidatesById[groupItem.id] = candidate;
        selectionById[groupItem.id] = candidate.key;
        appliedById[groupItem.id] = candidate.key;
        rememberedRowsById[groupItem.id] = true;
      } else {
        selectionById[groupItem.id] = selected;
        appliedById[groupItem.id] = selected;
      }
    }

    if (selectedCandidate) {
      setRememberedImportMatches((current) => ({ ...current, [rememberedKey]: selectedCandidate }));
      setImportReviewManualCandidates((current) => ({ ...current, ...candidatesById }));
      setImportReviewItems((current) =>
        current.map((review) =>
          candidatesById[review.item.id]
            ? {
                ...review,
                candidates: [
                  candidatesById[review.item.id],
                  ...review.candidates.filter((existing) => existing.key !== candidatesById[review.item.id].key),
                ],
              }
            : review
        )
      );
    }

    setImportReviewSelections((current) => ({ ...current, ...selectionById }));
    setImportReviewAppliedSelections((current) => ({ ...current, ...appliedById }));
    setImportReviewActions((current) => ({ ...current, ...actionById }));
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      delete next[item.id];
      return { ...next, ...rememberedRowsById };
    });
    setExpandedImportReviewGroups((current) => ({ ...current, [rememberedKey]: false }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !(id in actionById)));
    setImportErrors([]);
  }

  function rejectImportReviewItem(item: FoodLogImportDraft) {
    const groupKey = getImportReviewGroupKey(item);
    const rejectedById = Object.fromEntries(getImportReviewGroupItems(item).map((groupItem) => [groupItem.id, "rejected" as const]));
    setImportReviewActions((current) => ({ ...current, ...rejectedById }));
    setImportReviewAppliedSelections((current) => {
      const next = { ...current };
      Object.keys(rejectedById).forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      Object.keys(rejectedById).forEach((id) => delete next[id]);
      return next;
    });
    setExpandedImportReviewGroups((current) => ({ ...current, [groupKey]: false }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !(id in rejectedById)));
    setImportErrors([]);
  }

  function getManualImportMatchSource(food: Food): ImportMatchSource {
    if (recipes.some((recipe) => recipe.id === food.id)) return "recipe";
    if (customFoods.some((customFood) => customFood.id === food.id)) return "custom";
    return food.dataType === "local" ? "local" : "usda";
  }

  function buildManualImportCandidate(item: FoodLogImportDraft, food: Food): ImportFoodCandidate {
    const source = getManualImportMatchSource(food);
    const imported = buildImportFoodFromDraft(item, -Date.now());
    const importedBasis = parseImportServingBasis(imported.food.servingSize);
    const candidateBasis = parseImportServingBasis(food.servingSize);
    const ratio = importFoodUnitRatio(importedBasis, candidateBasis, imported.food.name, food.name);
    const autoCandidate = getImportFoodCandidate(imported, food, source);
    const importedTokens = getMeaningfulImportTokens(imported.food.name);
    const candidateTokens = getMeaningfulImportTokens(food.name);
    const specificityCoverage = autoCandidate?.specificityCoverage ?? getImportSpecificityCoverage(importedTokens, candidateTokens);
    const isGenericMatch = autoCandidate?.isGenericMatch ?? isGenericImportCandidate(importedTokens, candidateTokens, specificityCoverage);
    const key = `manual:${source}:${food.id}`;

    return {
      key,
      source,
      sourceLabel: autoCandidate?.sourceLabel ?? (source === "local" ? "Local" : source === "custom" ? "Custom" : source === "recipe" ? "Recipe" : "USDA"),
      food,
      score: autoCandidate?.score ?? 0,
      confidence: autoCandidate?.confidence ?? "medium",
      quantity: getCalorieScaledImportQuantity(imported, food),
      nameSimilarity: autoCandidate?.nameSimilarity ?? tokenSortSimilarityNormalized(normalizeImportMatchName(imported.food.name), normalizeImportMatchName(food.name)),
      unitCompatible: autoCandidate?.unitCompatible ?? ratio !== null,
      nutritionEdge: autoCandidate?.nutritionEdge ?? false,
      specificityCoverage,
      genericPenalty: autoCandidate?.genericPenalty ?? (isGenericMatch ? 35 : 0),
      isGenericMatch,
    };
  }

  function openImportReviewManualSearch(item: FoodLogImportDraft) {
    setImportReviewManualTarget(item);
    setImportReviewManualQuery(item.name);
    setImportReviewManualGroups([]);
    setImportErrors([]);
  }

  function closeImportReviewManualSearch() {
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setIsImportReviewManualSearching(false);
  }

  async function searchImportReviewManualFoods() {
    const query = importReviewManualQuery.trim();
    if (!query) return;

    setIsImportReviewManualSearching(true);
    try {
      setImportReviewManualGroups(await searchFoodsGrouped(query, customFoods, getRecentFoods(selectedDate), recipes));
    } catch (error) {
      appendDebugLog("import-review-manual-search-failed", {
        query,
        message: error instanceof Error ? error.message : String(error),
      });
      setImportErrors([`Manual search failed: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setIsImportReviewManualSearching(false);
    }
  }

  function selectImportReviewManualFood(food: Food) {
    if (!importReviewManualTarget) return;

    const item = importReviewManualTarget;
    const rememberedKey = normalizeImportName(item.name);
    const matchingReviews = importReviewItems.filter((review) => {
      if (normalizeImportName(review.item.name) !== rememberedKey) return false;
      return true;
    });
    const candidatesById = Object.fromEntries(
      matchingReviews.map((review) => [review.item.id, buildManualImportCandidate(review.item, food)])
    );
    const selectionById = Object.fromEntries(
      Object.entries(candidatesById).map(([id, candidate]) => [id, candidate.key])
    );
    const rememberedRowsById = Object.fromEntries(
      matchingReviews
        .filter((review) => review.item.id !== item.id)
        .map((review) => [review.item.id, true])
    );

    setRememberedImportMatches((current) => ({ ...current, [rememberedKey]: buildManualImportCandidate(item, food) }));
    setImportReviewManualCandidates((current) => ({ ...current, ...candidatesById }));
    setImportReviewItems((current) =>
      current.map((review) =>
        candidatesById[review.item.id]
          ? {
              ...review,
              candidates: [
                candidatesById[review.item.id],
                ...review.candidates.filter((existing) => existing.key !== candidatesById[review.item.id].key),
              ],
            }
          : review
      )
    );
    setImportReviewSelections((current) => ({ ...current, ...selectionById }));
    setImportReviewAppliedSelections((current) => {
      const next = { ...current };
      Object.keys(candidatesById).forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewActions((current) => {
      const next = { ...current };
      Object.keys(candidatesById).forEach((id) => delete next[id]);
      return next;
    });
    setImportReviewRememberedRows((current) => {
      const next = { ...current };
      delete next[item.id];
      return { ...next, ...rememberedRowsById };
    });
    setExpandedImportReviewGroups((current) => ({ ...current, [rememberedKey]: true }));
    setUnresolvedImportReviewIds((current) => current.filter((id) => !(id in candidatesById)));
    setImportErrors([]);
    closeImportReviewManualSearch();
  }

  function getDayExportData() {
    const meals = getMealCategoriesForLog(log).map((category) => {
      const mealItems = getMealItems(category);
      const totals = getCategoryTotals(category);

      return {
        name: category,
        calories: totals.calories,
        macros: {
          protein: Number(totals.protein.toFixed(1)),
          carbs: Number(totals.carbs.toFixed(1)),
          fat: Number(totals.fat.toFixed(1)),
        },
        foods: mealItems.map((item) => ({
          name: getFoodDisplayName(item),
          brand: item.brand ? getBrandDisplayName(item.brand) : null,
          servingSize: item.servingSize,
          serving: item.servingSize,
          servings: item.quantity,
          calories: getItemCalories(item),
          macros: {
            protein: Number((item.protein * item.quantity).toFixed(1)),
            carbs: Number((item.carbs * item.quantity).toFixed(1)),
            fat: Number((item.fat * item.quantity).toFixed(1)),
            ...(item.fiber !== undefined ? { fiber: Number((item.fiber * item.quantity).toFixed(1)) } : {}),
            ...(item.sugar !== undefined ? { sugar: Number((item.sugar * item.quantity).toFixed(1)) } : {}),
            ...(item.sodium !== undefined ? { sodium: Number((item.sodium * item.quantity).toFixed(1)) } : {}),
          },
          ...(item.notes ? { notes: item.notes } : {}),
          ...(item.source ? { source: item.source } : {}),
        })),
      };
    });
    const dayWeightEntry = weightEntries.find((entry) => entry.date === selectedDate) ?? null;

    return {
      date: selectedDate,
      calorieBudget: goals?.calories ?? null,
      totals: {
        calories: totalCalories,
        macros: {
          protein: Number(dailyTotals.protein.toFixed(1)),
          carbs: Number(dailyTotals.carbs.toFixed(1)),
          fat: Number(dailyTotals.fat.toFixed(1)),
        },
      },
      meals,
      weightEntry: dayWeightEntry
        ? {
            weight: dayWeightEntry.weight,
            unit: dayWeightEntry.unit,
            ...(dayWeightEntry.note ? { notes: dayWeightEntry.note } : {}),
          }
        : null,
      completed: completedDays.includes(selectedDate),
    };
  }

  function getDayExportFile() {
    const json = JSON.stringify(getDayExportData(), null, 2);
    return new File([json], `food-log-${selectedDate}.json`, { type: "application/json" });
  }

  function downloadDayExport() {
    setExportDriveLink("");
    const file = getDayExportFile();
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setExportStatus("Downloaded JSON file.");
  }

  function exportAllData() {
    const logs: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("log-")) {
        try {
          const val = localStorage.getItem(key);
          if (val) logs[key.slice(4)] = JSON.parse(val);
        } catch (error) {
          appendDebugLog("export-log-parse-skipped", {
            key,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    const data = {
      exportedAt: new Date().toISOString(),
      profile: getSavedProfile(),
      customFoods: getSavedCustomFoods(),
      recipes: getSavedRecipes(),
      weightEntries: getSavedWeightEntries(),
      foodLogs: logs,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jessica-data-${getLocalDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function clearAllData() {
    localStorage.clear();
    setLog([]);
    setCustomFoods([]);
    setRecipes([]);
    setWeightEntries([]);
    setCompletedDays([]);
    setTopFoods([]);
    setProfile(null);
    setGoals(null);
    setProfileForm(profileFormFromLegacyGoals(null));
    setProfileSaveStatus("");
    setIsProfileWizardOpen(true);
    setAppView("profile");
  }

  function clearFoodDebugData() {
    const logKeysToDelete: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("log-")) logKeysToDelete.push(key);
    }

    logKeysToDelete.forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem("customFoods");
    localStorage.removeItem("recipes");
    localStorage.removeItem("completedDays");
    localStorage.removeItem("topFoods");
    importCandidateCache.clear();
    importUsdaCandidateCache.clear();

    setLog([]);
    setCustomFoods([]);
    setRecipes([]);
    setCompletedDays([]);
    setTopFoods([]);
    setImportStatus("Debug clear complete. Food logs, custom foods, and recipes were removed.");
    setImportErrors([]);
    setImportDrafts([]);
    setImportSteps([]);
    setImportStepResults({ confirmed: 0, skipped: 0 });
    setImportReviewItems([]);
    setImportReviewSelections({});
    setImportReviewAppliedSelections({});
    setImportReviewActions({});
    setExpandedImportReviewGroups({});
    setImportReviewManualCandidates({});
    setRememberedImportMatches({});
    setImportReviewRememberedRows({});
    setImportReviewManualTarget(null);
    setImportReviewManualQuery("");
    setImportReviewManualGroups([]);
    setUnresolvedImportReviewIds([]);
    setImportResolutionProgress(null);
    setIsResolvingImport(false);
    appendDebugLog("debug-food-data-cleared", {
      logKeysDeleted: logKeysToDelete.length,
    });
  }

  function loadGoogleIdentityScript() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${googleIdentityScriptUrl}"]`
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("Google Identity script failed to load.")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = googleIdentityScriptUrl;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Identity script failed to load."));
      document.head.appendChild(script);
    });
  }

  async function getGoogleDriveAccessToken(
    clientId: string,
    pendingAction?: Pick<OAuthPendingAction, "action" | "fileId" | "fileName">
  ): Promise<string> {
    if (driveAccessToken) return driveAccessToken;

    if (isPwaStandalone()) {
      if (!pendingAction) throw new Error("PWA OAuth requires a pending action.");
      const pending: OAuthPendingAction = {
        ...pendingAction,
        clientId,
        returnView: appView,
        returnDate: selectedDate,
        timestamp: Date.now(),
      };
      localStorage.setItem(oauthPendingActionKey, JSON.stringify(pending));
      const redirectUri = window.location.origin + window.location.pathname;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "token",
        scope: googleDriveScope,
      });
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      return new Promise(() => {}); // page is navigating away
    }

    await loadGoogleIdentityScript();
    const oauth2 = window.google?.accounts?.oauth2;
    if (!oauth2) throw new Error("Google Identity Services is unavailable.");

    return new Promise<string>((resolve, reject) => {
      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: googleDriveScope,
        callback: (response) => {
          if (response.error || !response.access_token) {
            reject(new Error(response.error_description || response.error || "Google sign-in failed."));
            return;
          }
          resolve(response.access_token);
        },
      });
      tokenClient.requestAccessToken({ prompt: "consent" });
    });
  }

  async function getGoogleDriveUploadError(response: Response) {
    const fallback = `Google Drive upload failed (${response.status}).`;
    const errorText = await response.text();

    if (!errorText) return fallback;

    try {
      const parsed = JSON.parse(errorText) as {
        error?: {
          message?: string;
          status?: string;
        };
      };
      return parsed.error?.message || parsed.error?.status || fallback;
    } catch {
      return errorText;
    }
  }

  async function getGoogleDriveRequestError(response: Response, action: string) {
    const fallback = `Google Drive ${action} failed (${response.status}).`;
    const errorText = await response.text();

    if (!errorText) return fallback;

    try {
      const parsed = JSON.parse(errorText) as {
        error?: {
          message?: string;
          status?: string;
        };
      };
      return parsed.error?.message || parsed.error?.status || fallback;
    } catch {
      return errorText;
    }
  }

  async function _doOpenDriveImport(token: string) {
    setIsLoadingDriveImport(true);
    setDriveImportStatus("Loading JSON files from Google Drive...");
    try {
      const params = new URLSearchParams({
        pageSize: "20",
        orderBy: "modifiedTime desc",
        spaces: "drive",
        fields: "files(id,name,modifiedTime,size)",
        q: "(mimeType='application/json' or name contains '.json') and trashed=false",
      });
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await getGoogleDriveRequestError(response, "file list"));
      const result = (await response.json()) as GoogleDriveFileListResponse;
      const files = result.files ?? [];
      setDriveImportFiles(files);
      setIsDriveImportOpen(true);
      setDriveImportStatus(files.length > 0 ? "" : "No JSON files were available to this app in Google Drive.");
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Google Drive import failed.");
    } finally {
      setIsLoadingDriveImport(false);
    }
  }

  async function _doImportDriveFile(token: string, fileId: string, fileName: string) {
    setIsLoadingDriveImport(true);
    setDriveImportStatus(`Loading ${fileName}...`);
    try {
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(await getGoogleDriveRequestError(response, "file download"));
      await loadFoodLogImportText(await response.text(), fileName);
      setDriveImportStatus("");
      setIsDriveImportOpen(false);
      setIsExportPanelOpen(false);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Could not import that Google Drive file.");
    } finally {
      setIsLoadingDriveImport(false);
    }
  }

  async function _doUploadToDrive(token: string) {
    setIsUploadingToDrive(true);
    setExportStatus("Uploading to Google Drive...");
    try {
      const file = getDayExportFile();
      const metadata = { name: file.name, mimeType: "application/json" };
      const boundary = `jessica_${createClientId().replace(/[^a-zA-Z0-9]/g, "")}`;
      const body = new Blob(
        [
          `--${boundary}\r\n`,
          "Content-Type: application/json; charset=UTF-8\r\n\r\n",
          JSON.stringify(metadata),
          "\r\n",
          `--${boundary}\r\n`,
          "Content-Type: application/json\r\n\r\n",
          await file.text(),
          "\r\n",
          `--${boundary}--`,
        ],
        { type: `multipart/related; boundary=${boundary}` }
      );
      const response = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        }
      );
      if (!response.ok) throw new Error(await getGoogleDriveUploadError(response));
      const uploaded = (await response.json()) as GoogleDriveUploadResponse;
      setExportDriveLink(uploaded.webViewLink ?? "");
      setExportStatus(`Uploaded ${uploaded.name ?? file.name} to Google Drive.`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Google Drive upload failed.");
    } finally {
      setIsUploadingToDrive(false);
    }
  }

  async function resumePendingOAuthAction(pending: OAuthPendingAction, token: string) {
    switch (pending.action) {
      case "import-list":
        setExportDriveLink("");
        setDriveImportFiles([]);
        await _doOpenDriveImport(token);
        break;
      case "import-file":
        if (pending.fileId && pending.fileName) {
          await _doImportDriveFile(token, pending.fileId, pending.fileName);
        }
        break;
      case "export":
        setExportDriveLink("");
        setIsExportPanelOpen(true);
        await _doUploadToDrive(token);
        break;
    }
  }

  async function openDriveImport() {
    if (isLoadingDriveImport) return;
    const clientId = googleDriveClientId.trim();
    setExportDriveLink("");
    setDriveImportFiles([]);
    if (!clientId) { setExportStatus("Add your Google OAuth Client ID first."); return; }
    localStorage.setItem(googleDriveClientIdKey, clientId);
    setDriveImportStatus("Authorizing with Google...");
    try {
      const token = await getGoogleDriveAccessToken(clientId, { action: "import-list" });
      await _doOpenDriveImport(token);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Google Drive import failed.");
      setIsLoadingDriveImport(false);
    }
  }

  async function importGoogleDriveFile(file: GoogleDriveFile) {
    if (isLoadingDriveImport) return;
    const clientId = googleDriveClientId.trim();
    if (!clientId) { setDriveImportStatus("Add your Google OAuth Client ID first."); return; }
    try {
      const token = await getGoogleDriveAccessToken(clientId, { action: "import-file", fileId: file.id, fileName: file.name });
      await _doImportDriveFile(token, file.id, file.name);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Could not import that Google Drive file.");
      setIsLoadingDriveImport(false);
    }
  }

  async function uploadDayExportToDrive() {
    if (isUploadingToDrive) return;
    const clientId = googleDriveClientId.trim();
    setExportDriveLink("");
    if (!clientId) { setExportStatus("Add your Google OAuth Client ID first."); return; }
    localStorage.setItem(googleDriveClientIdKey, clientId);
    setExportStatus("Authorizing with Google...");
    try {
      const token = await getGoogleDriveAccessToken(clientId, { action: "export" });
      await _doUploadToDrive(token);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Google Drive upload failed.");
      setIsUploadingToDrive(false);
    }
  }

  function saveWeightEntry() {
    setWeightSaveError("");
    const weight = parseDecimalInput(weightForm.weight);
    appendDebugLog("weight-save-click", {
      rawWeight: weightForm.weight,
      parsedWeight: weight,
      date: weightForm.date,
      editingWeightEntryId,
      disabledState: !isWeightFormValid,
    });

    if (!Number.isFinite(weight) || weight <= 0) {
      const message = "Enter a valid weight before saving.";
      setWeightSaveError(message);
      appendDebugLog("weight-save-invalid", { rawWeight: weightForm.weight, parsedWeight: weight });
      return;
    }

    const entry: WeightEntry = {
      id: editingWeightEntryId ?? createClientId(),
      date: weightForm.date || today,
      weight,
      unit: getPreferredWeightUnit(goals),
      note: weightForm.note.trim() || undefined,
    };

    const nextWeightEntries = editingWeightEntryId
      ? weightEntries.map((item) => (item.id === editingWeightEntryId ? entry : item))
      : [entry, ...weightEntries];
    const storageOk = setStorageJson("weightEntries", nextWeightEntries);
    const verified = verifyStorageCount("weightEntries", nextWeightEntries.length);

    setWeightEntries(nextWeightEntries);

    if (!storageOk || !verified) {
      const message = "Weight was created in memory, but this browser did not confirm it was saved.";
      setWeightSaveError(message);
      appendDebugLog("weight-save-not-persisted", { storageOk, verified });
      return;
    }

    setEditingWeightEntryId(null);
    setWeightForm({
      date: today,
      weight: "",
      note: "",
    });
    appendDebugLog("weight-save-success", {
      id: entry.id,
      count: nextWeightEntries.length,
      persisted: true,
    });
  }

function startEditWeightEntry(entry: WeightEntry) {
  setEditingWeightEntryId(entry.id);

  setWeightForm({
    date: entry.date,
    weight: String(entry.weight),
    note: entry.note ?? "",
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}
  function confirmDeleteWeightEntry() {
    if (!weightEntryToDelete) return;

    setWeightEntries(weightEntries.filter((entry) => entry.id !== weightEntryToDelete.id));
    setWeightEntryToDelete(null);
  }

  function logTapProbe(name: string, phase: string, event: SyntheticEvent<HTMLElement>) {
    const nativeEvent = event.nativeEvent as Event & {
      pointerType?: string;
      clientX?: number;
      clientY?: number;
      touches?: TouchList;
      changedTouches?: TouchList;
    };
    const firstTouch = nativeEvent.touches?.[0] ?? nativeEvent.changedTouches?.[0] ?? null;
    const clientX = typeof nativeEvent.clientX === "number" ? nativeEvent.clientX : firstTouch?.clientX;
    const clientY = typeof nativeEvent.clientY === "number" ? nativeEvent.clientY : firstTouch?.clientY;
    const currentTarget = event.currentTarget;
    const rect = currentTarget.getBoundingClientRect();
    const elementAtPoint =
      typeof clientX === "number" && typeof clientY === "number"
        ? document.elementFromPoint(clientX, clientY)
        : null;

    appendDebugLog("tap-probe", {
      name,
      phase,
      eventType: event.type,
      nativeType: nativeEvent.type,
      pointerType: nativeEvent.pointerType ?? "unknown",
      defaultPrevented: event.defaultPrevented || nativeEvent.defaultPrevented,
      target: event.target instanceof Element
        ? `${event.target.tagName.toLowerCase()}${event.target.id ? `#${event.target.id}` : ""}${event.target.className ? `.${String(event.target.className).replace(/\s+/g, ".")}` : ""}`
        : String(event.target),
      currentTarget: `${currentTarget.tagName.toLowerCase()}${currentTarget.className ? `.${String(currentTarget.className).replace(/\s+/g, ".")}` : ""}`,
      elementAtPoint: elementAtPoint
        ? `${elementAtPoint.tagName.toLowerCase()}${elementAtPoint.id ? `#${elementAtPoint.id}` : ""}${elementAtPoint.className ? `.${String(elementAtPoint.className).replace(/\s+/g, ".")}` : ""}`
        : null,
      clientX,
      clientY,
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      },
      scrollY: Math.round(window.scrollY),
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    });
  }

  function tapProbeProps(name: string) {
    return {
      onPointerDownCapture: (event: SyntheticEvent<HTMLElement>) => logTapProbe(name, "pointerdown-capture", event),
      onTouchStartCapture: (event: SyntheticEvent<HTMLElement>) => logTapProbe(name, "touchstart-capture", event),
      onClickCapture: (event: SyntheticEvent<HTMLElement>) => logTapProbe(name, "click-capture", event),
    };
  }

  function getDebugLogText() {
    try {
      const saved = localStorage.getItem(debugLogKey);
      return saved ? JSON.stringify(JSON.parse(saved), null, 2) : "[]";
    } catch (error) {
      return `Could not read debug log: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async function copyDebugLog() {
    const text = getDebugLogText();
    setDebugLogText(text);

    try {
      await navigator.clipboard.writeText(text);
      setDebugCopyStatus("Copied");
    } catch {
      setDebugCopyStatus("Copy failed. Select and copy the text.");
    }
  }

  function clearDebugLog() {
    localStorage.removeItem(debugLogKey);
    setDebugLogText("[]");
    setDebugCopyStatus("Cleared");
  }

  function openFoodLibrary() {
    setAppView("library");
    setFoodLibraryTab("recent");
    setLibraryQuery("");
    setLibrarySelection(null);
    cancelLibraryEditing();
  }

  function updateProfileForm(updates: Partial<ProfileForm>) {
    setProfileForm((current) => {
      const next = { ...current, ...updates };

      if (updates.units && updates.units !== current.units) {
        const currentHeightCm = getProfileHeightCm(current);
        const currentWeightKg = getProfileWeightKg(current);
        const currentGoalWeightKg = getProfileGoalWeightKg(current);

        if (currentHeightCm !== null) {
          const totalInches = cmToTotalInches(currentHeightCm);
          next.heightCm = formatProfileNumber(currentHeightCm, 1);
          next.heightFeet = String(Math.floor(totalInches / 12));
          next.heightInches = formatProfileNumber(totalInches % 12, 1);
        }

        if (currentWeightKg !== null) {
          next.weight = updates.units === "metric"
            ? formatProfileNumber(currentWeightKg, 1)
            : formatProfileNumber(kgToLb(currentWeightKg), 1);
        }

        if (currentGoalWeightKg !== null) {
          next.goalWeight = updates.units === "metric"
            ? formatProfileNumber(currentGoalWeightKg, 1)
            : formatProfileNumber(kgToLb(currentGoalWeightKg), 1);
        }
      }

      if (updates.goal === "maintain") {
        next.weeklyRateKg = "0.5";
      }

      if (updates.macroPreset && updates.macroPreset !== "custom") {
        const preset = macroPresets[updates.macroPreset];
        next.macroMode = "percentages";
        next.proteinPct = preset.proteinPct;
        next.carbPct = preset.carbPct;
        next.fatPct = preset.fatPct;
      }

      if (updates.macroPreset === "custom") {
        next.macroMode = "percentages";
      }

      return next;
    });
    setProfileSaveStatus("");
  }

  function cancelProfileChanges() {
    if (!profile) return;
    setProfileForm(profileToForm(profile));
    setProfileSaveStatus("");
    setIsProfileWizardOpen(false);
    setProfileWizardStep(0);
  }

  function saveProfile() {
    const errors = getProfileValidationErrors(profileForm);
    if (Object.keys(errors).length > 0) return;

    const nextProfile = profileFormToProfile(profileForm, profile);
    if (!nextProfile) return;

    if (profile) setStorageJson("profile_backup", profile);
    const savedProfile = setStorageJson("profile", nextProfile);
    if (!savedProfile) {
      setProfileSaveStatus("Profile could not be saved in this browser.");
      return;
    }

    const nextGoals = profileToGoals(nextProfile);
    setStorageJson("goals", nextGoals);
    setProfile(nextProfile);
    setProfileForm(profileToForm(nextProfile));
    setGoals(nextGoals);
    setProfileSaveStatus("Profile saved.");
    setIsProfileWizardOpen(false);
    setProfileWizardStep(0);
    setAppView("profile");
  }

  function setCycleTrackingPreference(trackCycle: boolean) {
    setProfileForm((current) => ({ ...current, trackCycle }));
    if (!profile) return;

    const nextProfile: Profile = {
      ...profile,
      trackCycle,
      profileUpdatedAt: new Date().toISOString(),
    };
    const savedProfile = setStorageJson("profile", nextProfile);
    if (!savedProfile) {
      setProfileSaveStatus("Profile could not be saved in this browser.");
      return;
    }

    setProfile(nextProfile);
    setProfileForm(profileToForm(nextProfile));
    setProfileSaveStatus("Profile saved.");
  }

  function cancelLibraryEditing() {
    setEditingCustomFoodId(null);
    setEditingRecipeId(null);
    setIsCreatingLibraryCustomFood(false);
    setIsCreatingLibraryRecipe(false);
    setLibraryCustomFoodForm(emptyCustomFoodForm);
    setLibraryRecipeForm(emptyRecipeForm);
    setLibraryRecipeIngredients([]);
    setRecipeIngredientQuery("");
    setRecipeIngredientFoods([]);
    setIsSearchingRecipeIngredients(false);
    setPendingRecipeIngredient(null);
    setPendingRecipeIngredientQuantity("1");
  }

  function createLibraryCustomFood() {
    setFoodLibraryTab("custom");
    setLibrarySelection(null);
    setEditingCustomFoodId(null);
    setEditingRecipeId(null);
    setIsCreatingLibraryRecipe(false);
    setIsCreatingLibraryCustomFood(true);
    setLibraryCustomFoodForm(emptyCustomFoodForm);
  }

  function editCustomFood(food: Food) {
    setEditingCustomFoodId(food.id);
    setEditingRecipeId(null);
    setIsCreatingLibraryCustomFood(false);
    setIsCreatingLibraryRecipe(false);
    setLibraryCustomFoodForm(foodToCustomFoodForm(food));
    setLibrarySelection({ type: "custom", food });
  }

  function saveNewLibraryCustomFood() {
    const customFood = parseCustomFood(libraryCustomFoodForm);
    if (!customFood) return;

    setCustomFoods([customFood, ...customFoods]);
    setLibrarySelection({ type: "custom", food: customFood });
    cancelLibraryEditing();
  }

  function saveLibraryCustomFood() {
    if (editingCustomFoodId === null) return;

    const updatedFood = parseCustomFood(libraryCustomFoodForm);
    if (!updatedFood) return;

    const foodWithExistingId = { ...updatedFood, id: editingCustomFoodId };

    setCustomFoods(
      customFoods.map((food) => (food.id === editingCustomFoodId ? foodWithExistingId : food))
    );
    setLibrarySelection({ type: "custom", food: foodWithExistingId });
    cancelLibraryEditing();
  }

  function deleteCustomFood(foodId: number) {
    setCustomFoods(customFoods.filter((food) => food.id !== foodId));
    if (librarySelection?.type === "custom" && librarySelection.food.id === foodId) {
      setLibrarySelection(null);
    }
    if (editingCustomFoodId === foodId) cancelLibraryEditing();
  }

  function editRecipe(recipe: Recipe) {
    setEditingRecipeId(recipe.id);
    setEditingCustomFoodId(null);
    setIsCreatingLibraryCustomFood(false);
    setIsCreatingLibraryRecipe(false);
    setLibraryRecipeForm(recipeToRecipeForm(recipe));
    setLibraryRecipeIngredients(recipe.ingredients);
    setLibrarySelection({ type: "recipe", food: recipe });
  }

  function createLibraryRecipe() {
    setFoodLibraryTab("recipes");
    setLibrarySelection(null);
    setEditingCustomFoodId(null);
    setEditingRecipeId(null);
    setIsCreatingLibraryCustomFood(false);
    setIsCreatingLibraryRecipe(true);
    setLibraryRecipeForm(emptyRecipeForm);
    setLibraryRecipeIngredients([]);
    setRecipeIngredientQuery("");
    setRecipeIngredientFoods([]);
    setPendingRecipeIngredient(null);
    setPendingRecipeIngredientQuantity("1");
  }

  function saveNewLibraryRecipe() {
    const recipe = parseRecipe(libraryRecipeForm, libraryRecipeIngredients);
    if (!recipe) return;

    setRecipes([recipe, ...recipes]);
    setLibrarySelection({ type: "recipe", food: recipe });
    cancelLibraryEditing();
  }

  function saveLibraryRecipe() {
    if (editingRecipeId === null) return;

    const updatedRecipe = parseRecipe(libraryRecipeForm, libraryRecipeIngredients);
    if (!updatedRecipe) return;

    const recipeWithExistingId = { ...updatedRecipe, id: editingRecipeId };

    setRecipes(
      recipes.map((recipe) => (recipe.id === editingRecipeId ? recipeWithExistingId : recipe))
    );
    setLibrarySelection({ type: "recipe", food: recipeWithExistingId });
    cancelLibraryEditing();
  }

  function deleteRecipe(recipeId: number) {
    setRecipes(recipes.filter((recipe) => recipe.id !== recipeId));
    if (librarySelection?.type === "recipe" && librarySelection.food.id === recipeId) {
      setLibrarySelection(null);
    }
    if (editingRecipeId === recipeId) cancelLibraryEditing();
  }

  function updateLibraryRecipeIngredientQuantity(foodId: number, quantity: string) {
    const parsedQuantity = Number(quantity);

    setLibraryRecipeIngredients(
      libraryRecipeIngredients.map((ingredient) =>
        ingredient.food.id === foodId
          ? {
              ...ingredient,
              quantity:
                Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : ingredient.quantity,
            }
          : ingredient
      )
    );
  }

  function removeLibraryRecipeIngredient(foodId: number) {
    setLibraryRecipeIngredients(
      libraryRecipeIngredients.filter((ingredient) => ingredient.food.id !== foodId)
    );
  }

  function confirmLibraryRecipeIngredient() {
    if (!pendingRecipeIngredient) return;

    const quantity = Number(pendingRecipeIngredientQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    const existingIngredient = libraryRecipeIngredients.find(
      (ingredient) => ingredient.food.id === pendingRecipeIngredient.id
    );

    if (existingIngredient) {
      setLibraryRecipeIngredients(
        libraryRecipeIngredients.map((ingredient) =>
          ingredient.food.id === pendingRecipeIngredient.id
            ? { ...ingredient, quantity: ingredient.quantity + quantity }
            : ingredient
        )
      );
    } else {
      setLibraryRecipeIngredients([
        ...libraryRecipeIngredients,
        { food: pendingRecipeIngredient, quantity },
      ]);
    }

    setPendingRecipeIngredient(null);
    setPendingRecipeIngredientQuantity("1");
  }

  const portionOptions = getPortionOptions(selectedFoodDetail, selectedFood?.name);
  const selectedPortion = portionOptions.find((portion) => portion.value === selectedPortionValue);
  const rawPortionAmount = Number(portionAmount);
  const measuredServingBasis = selectedFood ? getMeasuredServingBasis(selectedFood) : null;
  const allowedAmountUnits: AmountUnit[] =
    selectedFood?.measurementType === "liquid"
      ? ["serving", "ml", "cup", "tbsp", "tsp"]
      : selectedFood?.measurementType === "spoonable"
        ? ["serving", "g", "oz", "tbsp", "tsp"]
        : ["serving", "g", "oz"];
  const portionAmountInBasisUnits =
    amountUnit === "serving"
      ? rawPortionAmount
      : measuredServingBasis && Number.isFinite(rawPortionAmount) && rawPortionAmount > 0
        ? convertAmountToBasisUnit(rawPortionAmount, amountUnit, measuredServingBasis.unit)
        : null;
  const localPortionScale =
    selectedFood &&
    hasUsableSearchNutrition(selectedFood) &&
    Number.isFinite(rawPortionAmount) &&
    rawPortionAmount > 0 &&
    portionAmountInBasisUnits !== null
      ? getScaleFromServingBasis(selectedFood, portionAmountInBasisUnits)
      : null;
  const usesLocalPortion = Boolean(selectedFood && hasUsableSearchNutrition(selectedFood));
  const selectedPortionCalories = selectedFood
    ? usesLocalPortion && localPortionScale === null
      ? null
      : localPortionScale !== null
      ? Math.round(selectedFood.calories * localPortionScale)
      : getCaloriesPerServing(selectedFood, selectedFoodDetail, selectedPortion)
    : null;
  const visibleMealCategories = getMealCategoriesForLog(log);
  const recentFoods = getRecentFoods(selectedDate);
  const filteredCustomFoods = customFoods.filter((food) => matchesFoodQuery(food, customQuery));
  const filteredRecipes = recipes.filter((recipe) => matchesFoodQuery(recipe, recipeQuery));
  const libraryRecentFoods = recentFoods.filter((food) => matchesFoodQuery(food, libraryQuery));
  const libraryCustomFoods = customFoods.filter((food) => matchesFoodQuery(food, libraryQuery));
  const libraryRecipes = recipes.filter((recipe) => matchesFoodQuery(recipe, libraryQuery));
  const recipeIngredientOptions = [...customFoods, ...recentFoods, ...recipeIngredientFoods].filter(
    (food, index, foods) => {
      return (
        matchesFoodQuery(food, recipeIngredientQuery) &&
        foods.findIndex((candidate) => candidate.id === food.id) === index
      );
    }
  );
  const recipeTotals = getRecipeTotals(recipeIngredients);
  const weightUnit = getPreferredWeightUnit(goals);
  const sortedWeightEntriesNewest = sortWeightEntriesNewestFirst(weightEntries);
  const sortedWeightEntriesOldest = sortWeightEntriesOldestFirst(weightEntries);
  const weightRangeStartDate = getWeightRangeStartDate(weightRange, today);
  const chartWeightEntries =
    weightRange === "All"
      ? sortedWeightEntriesOldest
      : sortedWeightEntriesOldest.filter((entry) => entry.date >= weightRangeStartDate);
  const currentWeightEntry = sortedWeightEntriesNewest[0] ?? null;
  const startingWeightEntry = sortedWeightEntriesOldest[0] ?? null;
  const parsedWeightFormValue = parseDecimalInput(weightForm.weight);
  const isWeightFormValid = parsedWeightFormValue > 0 && Number.isFinite(parsedWeightFormValue);
 console.log("ADD FOOD DEBUG", {
  selectedFood: Boolean(selectedFood),
  isSearchPreview: selectedFood?.isSearchPreview,
  isLoadingDetail,
  amountUnit,
  allowedAmountUnits,
  localPortionScale,
  selectedPortionCalories,
  portionOptionsLength: portionOptions.length,
  selectedPortion: Boolean(selectedPortion),
});
  const canAddSelectedFood =
    Boolean(selectedFood) &&
    !selectedFood?.isSearchPreview &&
    !isLoadingDetail &&
    (amountUnit === "serving" || (allowedAmountUnits.includes(amountUnit) && selectedPortionCalories !== null)) &&
    (amountUnit !== "serving" || portionOptions.length === 0 || Boolean(selectedPortion));
  const servingBasisText =
    amountUnit === "serving"
      ? `Based on ${measuredServingBasis ? `${measuredServingBasis.amount}${measuredServingBasis.unit}` : selectedFood?.servingSize ?? "serving"}`
      : `Using ${Number.isFinite(rawPortionAmount) && rawPortionAmount > 0 ? rawPortionAmount : ""} ${amountUnit}`.trim();
  const profileCalculation = calculateProfile(profileForm);
  const profileErrors = getProfileValidationErrors(profileForm);
  const profileHasBlockingErrors = Object.keys(profileErrors).length > 0 || profileCalculation === null;
  const profileLowCalorieThreshold = profileForm.sex === "female" ? 1200 : 1500;
  const profileLowCalorieWarning =
    profileCalculation && profileCalculation.activeCalories < profileLowCalorieThreshold
      ? `This target is below ${profileLowCalorieThreshold} kcal/day. Consider a slower rate.`
      : "";

  function navigateAppView(view: AppView) {
    setLibrarySelection(null);
    cancelLibraryEditing();
    setAppView(view);
  }

  const bottomNav = (
    <AppChrome
      appView={appView}
      onNavigate={navigateAppView}
      onOpenLibrary={openFoodLibrary}
      isDebugPanelOpen={isDebugPanelOpen}
      debugLogText={debugLogText}
      debugCopyStatus={debugCopyStatus}
      onCloseDebugPanel={() => setIsDebugPanelOpen(false)}
      onCopyDebugLog={copyDebugLog}
      onClearDebugLog={clearDebugLog}
      showStreakPopup={showStreakPopup}
      streakPopupDate={streakPopupDate}
      completedDays={completedDays}
      getCompletedStreak={getCompletedStreak}
      onCloseStreakPopup={() => setShowStreakPopup(false)}
    />
  );

  return (
    <AppViewRouter
      appView={appView}
      onNavigate={navigateAppView}
      bottomNav={bottomNav}
      homeProps={{
        selectedDate,
        log,
        goals,
        homeSelectedDate,
        setHomeSelectedDate,
        changeSelectedDate,
        toggleHomeDate,
        today,
        getCompletedStreak,
        goalsView,
        setGoalsView,
        currentWeightEntry,
        startingWeightEntry,
        weightUnit,
      }}
      profileProps={{
        profile,
        profileForm,
        setProfileForm,
        updateProfileForm,
        profileCalculation,
        profileErrors,
        profileHasBlockingErrors,
        profileLowCalorieWarning,
        profileWizardStep,
        setProfileWizardStep,
        isProfileWizardOpen,
        setIsProfileWizardOpen,
        profileSaveStatus,
        setProfileSaveStatus,
        themeMode,
        setThemeMode,
        setCycleTrackingPreference,
        cancelProfileChanges,
        saveProfile,
        onOpenExport: exportAllData,
        onOpenImport: openImportFilePicker,
        onConnectDrive: openDriveImport,
        onDeleteAllData: clearAllData,
      }}
      weightProps={{
        today,
        weightUnit,
        profile,
        chartWeightEntries,
        currentWeightEntry,
        startingWeightEntry,
        weightForm,
        setWeightForm,
        weightSaveError,
        setWeightSaveError,
        isWeightFormValid,
        editingWeightEntryId,
        setEditingWeightEntryId,
        saveWeightEntry,
        tapProbeProps,
        logTapProbe,
        weightRange,
        setWeightRange,
        weightChartPointId,
        setWeightChartPointId,
        sortedWeightEntriesOldest,
        sortedWeightEntriesNewest,
        startEditWeightEntry,
        weightEntryToDelete,
        setWeightEntryToDelete,
        confirmDeleteWeightEntry,
      }}
      libraryProps={{
        foodLibraryTab,
        setFoodLibraryTab,
        libraryQuery,
        setLibraryQuery,
        librarySelection,
        setLibrarySelection,
        cancelLibraryEditing,
        createLibraryCustomFood,
        createLibraryRecipe,
        libraryRecentFoods,
        libraryCustomFoods,
        libraryRecipes,
        isCreatingLibraryCustomFood,
        isCreatingLibraryRecipe,
        editingCustomFoodId,
        editingRecipeId,
        editCustomFood,
        deleteCustomFood,
        libraryCustomFoodForm,
        setLibraryCustomFoodForm,
        saveNewLibraryCustomFood,
        saveLibraryCustomFood,
        editRecipe,
        deleteRecipe,
        libraryRecipeForm,
        setLibraryRecipeForm,
        recipeIngredientQuery,
        setRecipeIngredientQuery,
        searchRecipeIngredientFoods,
        recipeIngredientOptions,
        pendingRecipeIngredient,
        selectRecipeIngredient,
        isSearchingRecipeIngredients,
        pendingRecipeIngredientQuantity,
        setPendingRecipeIngredientQuantity,
        confirmLibraryRecipeIngredient,
        setPendingRecipeIngredient,
        libraryRecipeIngredients,
        updateLibraryRecipeIngredientQuantity,
        removeLibraryRecipeIngredient,
        saveNewLibraryRecipe,
        saveLibraryRecipe,
      }}
      logProps={{
        goals,
        totalCalories,
        dailyTotals,
        completedDays,
        selectedDate,
        moveSelectedDate,
        changeSelectedDate,
        importStatus,
        importErrors,
        importDrafts,
        isLogMenuOpen,
        setIsLogMenuOpen,
        setExportStatus,
        visibleMealCategories,
        getCategoryTotals,
        scrollToMeal,
        log,
        expandedMeals,
        mealCardRefs,
        toggleMeal,
        mealMenuCategory,
        setMealMenuCategory,
        openSaveMealAsRecipe,
        setMealToDelete,
        suppressNextClickRef,
        openEditFoodItem,
        setContextMenuItem,
        setContextMenuY,
        longPressRef,
        getItemCalories,
        logTapProbe,
        openAddFood,
        handleFinishToggle,
        pendingCategory,
        tapProbeProps,
        activeAddFoodTab,
        setActiveAddFoodTab,
        modalQuery,
        setModalQuery,
        searchModalFood,
        modalFoods,
        selectedFood,
        selectedFoodDetail,
        selectedPortion,
        isLoadingDetail,
        selectFood,
        recentFoods,
        selectLocalFood,
        customQuery,
        setCustomQuery,
        openCustomFoodForm,
        isCustomFormOpen,
        customFoodScanInputRef,
        isScanningCustomFood,
        scanCustomFoodLabel,
        customFoodOcrError,
        customFoodOcrText,
        customFoodForm,
        setCustomFoodForm,
        customFoodSaveError,
        createCustomFood,
        setIsCustomFormOpen,
        filteredCustomFoods,
        recipeQuery,
        setRecipeQuery,
        openRecipeForm,
        isRecipeFormOpen,
        recipeForm,
        setRecipeForm,
        recipeTotals,
        recipeIngredientQuery,
        setRecipeIngredientQuery,
        searchRecipeIngredientFoods,
        isSearchingRecipeIngredients,
        recipeIngredientOptions,
        pendingRecipeIngredient,
        selectRecipeIngredient,
        pendingRecipeIngredientQuantity,
        setPendingRecipeIngredientQuantity,
        confirmRecipeIngredient,
        setPendingRecipeIngredient,
        recipeIngredients,
        updateRecipeIngredientQuantity,
        removeRecipeIngredient,
        createRecipe,
        setIsRecipeFormOpen,
        filteredRecipes,
        closeAddFood,
        detailError,
        servingBasisText,
        amountUnit,
        portionOptions,
        selectedPortionValue,
        setSelectedPortionValue,
        quantity,
        setQuantity,
        portionAmount,
        setPortionAmount,
        setAmountUnit,
        allowedAmountUnits,
        selectedPortionCalories,
        addSelectedFood,
        canAddSelectedFood,
        setSelectedFood,
        importSteps,
        importStepIndex,
        cancelImportStepper,
        confirmImportStep,
        skipImportStep,
        importStepResults,
        closeImportSummary,
        importFileName,
        importWeightEntries,
        updateImportDraft,
        removeImportDraft,
        removeImportWeightEntry,
        confirmFoodLogImport,
        importReviewItems,
        importReviewSelections,
        importReviewAppliedSelections,
        importReviewActions,
        expandedImportReviewGroups,
        importReviewRememberedRows,
        importReviewManualTarget,
        importReviewManualQuery,
        setImportReviewManualQuery,
        importReviewManualGroups,
        isImportReviewManualSearching,
        unresolvedImportReviewIds,
        importResolutionProgress,
        updateImportReviewSelection,
        applyImportReviewToSimilar,
        rejectImportReviewItem,
        expandImportReviewGroup,
        openImportReviewManualSearch,
        closeImportReviewManualSearch,
        searchImportReviewManualFoods,
        selectImportReviewManualFood,
        confirmImportReview,
        isResolvingImport,
        clearFoodDebugData,
        closeImportPreview,
        isExportPanelOpen,
        setIsExportPanelOpen,
        googleDriveClientId,
        isUploadingToDrive,
        setGoogleDriveClientId,
        exportStatus,
        exportDriveLink,
        downloadDayExport,
        uploadDayExportToDrive,
        isImportDayOpen,
        setIsImportDayOpen,
        openDriveImport,
        isLoadingDriveImport,
        openImportFilePicker,
        isDriveImportOpen,
        setIsDriveImportOpen,
        driveImportStatus,
        driveImportFiles,
        importGoogleDriveFile,
        mealToSaveAsRecipe,
        mealRecipeName,
        setMealRecipeName,
        saveMealAsRecipe,
        setMealToSaveAsRecipe,
        mealToDelete,
        confirmDeleteMeal,
        itemToEdit,
        editItemAmountUnit,
        editItemAmount,
        setEditItemAmount,
        setEditItemAmountUnit,
        getEditAmountUnits,
        saveEditedFoodItem,
        setItemToEdit,
        itemToRemove,
        confirmRemoveFood,
        setItemToRemove,
        contextMenuItem,
        contextMenuY,
        moveToMealItem,
        setMoveToMealItem,
        moveItemToMeal,
        moveToDayItem,
        setMoveToDayItem,
        setMoveToDayDate,
        setMoveToDayStep,
        moveToDayStep,
        moveToDayDate,
        moveItemToDifferentDay,
      }}
    />
  );
}

export default App;
