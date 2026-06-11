import {
  appendDebugLog,
  setStorageJson,
  parseDecimalInput,
  createNegativeFoodId,
  getAllLocalFoods,
  searchFoodsGrouped,
  type Food,
  type Recipe,
  type FoodLogImportDraft,
  type LogItem,
} from "./appSupport";

export type ImportFoodResolution = {
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

export type ImportServingBasis = {
  amount: number;
  unitLabel: string;
  servingSize: string;
};

export type ImportFoodBatchResolver = {
  byDraftId: Map<string, ImportFoodResolution>;
  addedFoodIds: Set<number>;
};

export type ImportResolutionProgress = {
  resolved: number;
  total: number;
};

export type ImportReviewAction = "applied" | "rejected";

export type ImportMatchSource = "local" | "custom" | "recipe" | "usda";
export type ImportConfidenceTier = "high" | "medium" | "low";
export type ImportReviewMode = "preview" | "step";

export type ImportFoodCandidate = {
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

export type ImportReviewItem = {
  item: FoodLogImportDraft;
  importedFood: Food;
  candidates: ImportFoodCandidate[];
};

type ImportCandidateIndexEntry = {
  source: ImportMatchSource;
  food: Food;
  normalizedName: string;
};

export type ImportFoodBatchResolverOptions = {
  forceReviewAll?: boolean;
  manualCandidates?: Record<string, ImportFoodCandidate>;
  onProgress?: (progress: ImportResolutionProgress) => void;
};

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

export function parseImportServingBasis(serving: string): ImportServingBasis {
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

export function buildImportFoodFromDraft(item: FoodLogImportDraft, id: number): ImportFoodResolution {
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

export function normalizeImportMatchName(value: string) {
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

export function normalizeImportName(name: string) {
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

export function tokenSortSimilarityNormalized(left: string, right: string) {
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

export function getMeaningfulImportTokens(name: string) {
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

export function getImportSpecificityCoverage(importedTokens: string[], candidateTokens: string[]) {
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

export function isGenericImportCandidate(importedTokens: string[], candidateTokens: string[], specificityCoverage: number) {
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

export function importFoodUnitRatio(
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

export function getCalorieScaledImportQuantity(imported: ImportFoodResolution, food: Pick<Food, "calories" | "name" | "servingSize">) {
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

export function getImportFoodCandidate(
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

export function getDefaultImportReviewSelection(review: ImportReviewItem) {
  const top = review.candidates[0];
  return top ? top.key : "new";
}

export const importCandidateCache = new Map<string, ImportFoodCandidate[]>();
export const importUsdaCandidateCache = new Map<string, Food[]>();

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

export async function buildImportFoodBatchResolver(
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
          importedFood: buildImportFoodFromDraft(item, createNegativeFoodId()).food,
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

export function dedupeCustomFoods(foods: Food[]): { foods: Food[]; foodRemap: Map<number, Food> } {
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

export function remapLogFoodIds(items: LogItem[], foodRemap: Map<number, Food>): LogItem[] {
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

export function remapSavedLogFoodIds(foodRemap: Map<number, Food>) {
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
