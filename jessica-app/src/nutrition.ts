import type { AmountUnit, CustomFoodForm, Food, FoodDetail, FoodPortion, MeasuredAmountUnit, PortionOption, Recipe, RecipeForm, RecipeIngredient, ScannedNutritionFields, ScannedRecipeFields } from "./types";
import { createNegativeFoodId, escapeRegExp, parseDecimalInput } from "./format";

export const emptyCustomFoodForm: CustomFoodForm = {
  name: "",
  brand: "",
  servingSize: "",
  servingUnit: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  sugar: "",
  sodium: "",
  notes: "",
};

export const emptyRecipeForm: RecipeForm = {
  name: "",
  servingSize: "",
  servingUnit: "",
  notes: "",
};

export function formatServingDisplayAmount(amount: number | null | undefined) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";

  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
}

export function getFoodServingDisplay(
  food: Pick<Food, "servingSize" | "amount" | "amountUnit" | "portionLabel" | "servingLabel"> & { quantity?: number }
) {
  const servingLabel = food.servingLabel?.trim();
  if (servingLabel) return servingLabel;

  const amount = food.amount;
  const amountText = formatServingDisplayAmount(amount);
  const amountUnit = food.amountUnit;
  const portionLabel = food.portionLabel?.trim();

  if (amountText && amountUnit && amountUnit !== "serving") {
    return `${amountText} ${amountUnit}`;
  }

  if (portionLabel) {
    if (!amountText || amount === 1) return portionLabel;
    return `${amountText} x ${portionLabel}`;
  }

  if (amountText && amountUnit === "serving") {
    return `${amountText} serving${amount === 1 ? "" : "s"}`;
  }

  if (food.servingSize.trim()) {
    const quantity = food.quantity ?? 1;
    return quantity === 1 ? food.servingSize : `${food.servingSize} x ${formatServingDisplayAmount(quantity)}`;
  }

  return "100g";
}

export function getFoodSearchServingDisplay(
  food: Pick<Food, "dataType" | "measurementType" | "servingSize" | "amount" | "amountUnit" | "portionLabel" | "servingLabel">,
  servingSize = food.servingSize
) {
  const explicitDisplay = getFoodServingDisplay({ ...food, servingSize });
  const normalizedServing = servingSize.trim().toLowerCase().replace(/\s+/g, "");

  if (explicitDisplay !== servingSize && explicitDisplay !== "100g") return explicitDisplay;

  if (food.dataType === "local" && normalizedServing === "100g") {
    switch (food.measurementType) {
      case "liquid":
        return "cup";
      case "spoonable":
        return "tbsp";
      default:
        break;
    }
  }

  return servingSize.trim() || "100g";
}

export function getFoodSearchCalorieDisplay(
  food: Pick<
    Food,
    "name" | "calories" | "dataType" | "measurementType" | "servingSize" | "amount" | "amountUnit" | "portionLabel" | "portionScale" | "servingLabel"
  >,
  calories = food.calories,
  servingSize = food.servingSize
) {
  const serving = getFoodSearchServingDisplay(food, servingSize);
  const amountUnit = serving === "cup" || serving === "tbsp" || serving === "tsp" ? serving : food.amountUnit;

  if (food.portionScale !== undefined && Number.isFinite(food.portionScale)) {
    return { calories: Math.round(food.calories * food.portionScale), serving };
  }

  if (amountUnit && amountUnit !== "serving") {
    const amount = food.amount && Number.isFinite(food.amount) ? food.amount : 1;
    const basis = getMeasuredServingBasis(food);
    const basisAmount = basis ? convertAmountToBasisUnit(amount, amountUnit, basis.unit, getFoodDensity(food)) : null;
    const scale = basisAmount !== null ? getScaleFromServingBasis(food, basisAmount) : null;

    if (scale !== null) {
      return { calories: Math.round(food.calories * scale), serving };
    }
  }

  return { calories, serving };
}

export function cleanPortionText(text: string | null | undefined) {
  const cleaned = text?.trim();
  if (!cleaned) return "";

  if (cleaned.toLowerCase() === "undetermined") return "";
  if (/^[\d\s.,-]+$/.test(cleaned)) return "";

  return cleaned;
}

export function formatPortionAmount(amount: number | null | undefined) {
  if (!amount || !Number.isFinite(amount)) return "";

  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
}

export function formatGramWeight(gramWeight: number) {
  return Number.isInteger(gramWeight) ? `${gramWeight}g` : `${Number(gramWeight.toFixed(1))}g`;
}

export function formatGramWeightWithSpace(gramWeight: number) {
  return Number.isInteger(gramWeight) ? `${gramWeight} g` : `${Number(gramWeight.toFixed(1))} g`;
}

export function getLocalPortionUnit(food: Food) {
  return parseServingSize(food.servingSize)?.unit === "ml" ? "ml" : "g";
}

export function formatLocalPortionAmount(food: Food, amount: number) {
  const value = Number.isInteger(amount) ? amount : Number(amount.toFixed(1));
  return `${value}${getLocalPortionUnit(food)}`;
}

export function getPortionLabel(portion: FoodPortion, foodName: string) {
  const amount = formatPortionAmount(portion.amount);
  const modifier = cleanPortionText(portion.modifier);
  const measure = cleanPortionText(portion.measureUnit?.abbreviation || portion.measureUnit?.name);
  const gramWeight = portion.gramWeight ?? 0;

  if (modifier) {
    return [amount || "1", modifier, foodName].filter(Boolean).join(" ");
  }

  if (amount && measure) {
    return `${amount} ${measure}`;
  }

  if (measure) {
    return measure;
  }

  return formatGramWeight(gramWeight);
}

export function parseHouseholdServingText(text: string | null | undefined) {
  const cleaned = cleanPortionText(
    text
      ?.replace(/\([^)]*\b(?:g|gram|grams|ml|milliliter|milliliters|oz|ounce|ounces)\b[^)]*\)/gi, "")
      .replace(/\babout\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
  if (!cleaned) return null;

  const match = cleaned.match(/^(\d+(?:\.\d+)?|\d+\s*\/\s*\d+)\s+(.+)$/);
  if (!match) {
    return {
      amount: 1,
      label: cleaned,
      unitLabel: cleaned,
    };
  }

  const amount = match[1].includes("/")
    ? match[1].split("/").map(Number).reduce((numerator, denominator) => denominator ? numerator / denominator : 0)
    : Number(match[1]);
  const unitLabel = match[2].trim();

  if (!Number.isFinite(amount) || amount <= 0 || !unitLabel) return null;

  return {
    amount,
    label: `${formatPortionAmount(amount)} ${unitLabel}`.trim(),
    unitLabel,
  };
}

export function normalizePortionLabelForMatching(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(one|about)\b/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function isRawGramPortionLabel(value: string) {
  return /^\d+(?:\.\d+)?\s*(g|gram|grams)$/i.test(value.trim());
}

export function getServingBasisGramWeight(detail: FoodDetail | null) {
  const basis = parseServingSize(detail?.servingSize, detail?.servingSizeUnit ?? "");
  if (!basis) return null;

  if (basis.unit === "g") return basis.amount;
  if (basis.unit === "oz") return basis.amount * 28.349523125;

  return null;
}

export function toPortionOption(portion: FoodPortion, index: number, foodName: string): PortionOption | null {
  const gramWeight = portion.gramWeight ?? 0;
  if (!Number.isFinite(gramWeight) || gramWeight <= 0) return null;

  const label = getPortionLabel(portion, foodName);
  if (!label || isRawGramPortionLabel(label) || normalizePortionLabelForMatching(label) === "g") return null;

  const parsed = parseHouseholdServingText(label);
  const displayLabel =
    parsed && parsed.amount === 1
      ? `${parsed.unitLabel} (${formatGramWeightWithSpace(gramWeight)})`
      : `${label} (${formatGramWeightWithSpace(gramWeight)})`;

  return {
    value: String(portion.id ?? index),
    label,
    gramWeight,
    amount: parsed?.amount,
    unitLabel: parsed?.amount === 1 ? parsed.unitLabel : label,
    displayLabel,
    helperText: `${label} = ${formatGramWeightWithSpace(gramWeight)}`,
  };
}

export function getPreferredHouseholdPortion(detail: FoodDetail | null, foodName = ""): PortionOption | undefined {
  const portionOptions =
    detail?.foodPortions
      ?.map((portion, index) => toPortionOption(portion, index, foodName))
      .filter((portion): portion is PortionOption => Boolean(portion)) ?? [];
  const household = parseHouseholdServingText(detail?.householdServingFullText);
  const basisGramWeight = getServingBasisGramWeight(detail);

  if (household && basisGramWeight !== null) {
    return {
      value: "__household_serving",
      label: household.label,
      gramWeight: basisGramWeight,
      amount: household.amount,
      unitLabel: household.amount === 1 ? household.unitLabel : household.label,
      displayLabel: household.amount === 1
        ? `${household.unitLabel} (${formatGramWeightWithSpace(basisGramWeight)})`
        : `${household.label} (${formatGramWeightWithSpace(basisGramWeight)})`,
      helperText: `${household.label} = ${formatGramWeightWithSpace(basisGramWeight)}`,
    };
  }

  if (household) {
    const normalizedHousehold = normalizePortionLabelForMatching(household.label);
    const matchingPortion = portionOptions.find((portion) => {
      const normalizedLabel = normalizePortionLabelForMatching(portion.label);
      return normalizedLabel === normalizedHousehold ||
        normalizedLabel.includes(normalizedHousehold) ||
        normalizedHousehold.includes(normalizedLabel);
    });
    if (matchingPortion) return matchingPortion;
  }

  return portionOptions.find((portion) => {
    const normalized = normalizePortionLabelForMatching(portion.label);
    return normalized !== "g" && normalized !== "gram" && normalized !== "grams" && !isRawGramPortionLabel(portion.label);
  });
}

export function getPortionOptions(detail: FoodDetail | null, foodName = ""): PortionOption[] {
  const portions =
    detail?.foodPortions
      ?.map((portion, index) => toPortionOption(portion, index, foodName))
      .filter((portion): portion is PortionOption => Boolean(portion)) ?? [];
  const preferredPortion = getPreferredHouseholdPortion(detail, foodName);

  if (!preferredPortion) return portions;

  const preferredLabel = normalizePortionLabelForMatching(preferredPortion.label);
  return [
    preferredPortion,
    ...portions.filter((portion) => {
      const sameLabel = normalizePortionLabelForMatching(portion.label) === preferredLabel;
      const sameValue = portion.value === preferredPortion.value;
      return !sameLabel && !sameValue;
    }),
  ];
}

export function getEnergyCaloriesPer100Units(detail: FoodDetail | null) {
  const energy = detail?.foodNutrients?.find((nutrient) => {
    const name = nutrient.nutrient?.name ?? nutrient.nutrientName ?? "";
    const unit = nutrient.nutrient?.unitName ?? nutrient.unitName ?? "";

    return name.toLowerCase() === "energy" && unit.toLowerCase() === "kcal";
  });

  const amount = energy?.amount ?? energy?.value;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

export function getLabelCaloriesPerServing(detail: FoodDetail | null) {
  const calories = detail?.labelNutrients?.calories?.value;

  return typeof calories === "number" && Number.isFinite(calories) && calories > 0
    ? Math.round(calories)
    : null;
}

export function parseServingSize(value: string | number | null | undefined, fallbackUnit = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      amount: value,
      unit: fallbackUnit.trim().toLowerCase(),
    };
  }

  if (typeof value !== "string") return null;

  const trimmedValue = value.trim();
  const embeddedMeasure = trimmedValue.match(/([\d.]+)\s*(ml|milliliter|milliliters|g|gram|grams|oz|ounce|ounces)\b/i);

  if (embeddedMeasure) {
    const amount = Number(embeddedMeasure[1]);
    const unit = normalizeAmountUnit(embeddedMeasure[2]);

    if (Number.isFinite(amount) && amount > 0 && unit) {
      return { amount, unit };
    }
  }

  const match = trimmedValue.match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    amount,
    unit: normalizeAmountUnit(fallbackUnit || match[2]) ?? (fallbackUnit || match[2]).trim().toLowerCase(),
  };
}

export function isGramUnit(unit: string) {
  return unit === "g" || unit === "ml" || unit === "oz";
}

export function normalizeAmountUnit(unit: string): MeasuredAmountUnit | null {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "ml" || normalized === "milliliter" || normalized === "milliliters") return "ml";
  if (normalized === "g" || normalized === "gram" || normalized === "grams") return "g";
  if (normalized === "oz" || normalized === "ounce" || normalized === "ounces") return "oz";
  return null;
}

export function getMeasuredServingBasis(food: Pick<Food, "servingSize">) {
  const basis = parseServingSize(food.servingSize);
  const unit = basis ? normalizeAmountUnit(basis.unit) : null;
  return basis && unit ? { amount: basis.amount, unit } : null;
}

// Approximate densities in g/ml for foods commonly logged by volume, matched against
// the food name with whole-word keywords (first hit wins, so multi-word rules like
// "peanut butter" must come before their general fallback like "butter"). Foods with
// no rule fall back to 1.0 (water), which fits most drinkable liquids.

export const foodDensityRules: [keyword: string, density: number][] = [
  ["peanut butter", 1.09],
  ["almond butter", 1.09],
  ["ice cream", 0.55],
  ["sour cream", 0.97],
  ["cream cheese", 1.01],
  ["cottage cheese", 1.04],
  ["protein powder", 0.5],
  ["milk", 1.03],
  ["yogurt", 1.04],
  ["juice", 1.05],
  ["soda", 1.04],
  ["cola", 1.04],
  ["oil", 0.92],
  ["butter", 0.95],
  ["mayonnaise", 0.91],
  ["mayo", 0.91],
  ["honey", 1.42],
  ["syrup", 1.33],
  ["jam", 1.35],
  ["jelly", 1.35],
  ["ketchup", 1.14],
  ["dressing", 0.95],
  ["creamer", 1.0],
  ["cream", 1.01],
  ["sugar", 0.85],
  ["flour", 0.53],
  ["oats", 0.41],
  ["oatmeal", 0.41],
  ["rice", 0.7],
  ["salsa", 1.04],
];

export const defaultFoodDensity = 1;

export function getFoodDensity(food: Pick<Food, "name">): number {
  const name = food.name.toLowerCase();
  const match = foodDensityRules.find(([keyword]) =>
    new RegExp(`\\b${escapeRegExp(keyword)}\\b`).test(name)
  );
  return match?.[1] ?? defaultFoodDensity;
}

export const gramsPerOunce = 28.349523125;

export const mlPerTbsp = 15;

export const mlPerTsp = 5;

export const mlPerCup = 240;

export function convertAmountToBasisUnit(
  amount: number,
  amountUnit: AmountUnit,
  basisUnit: MeasuredAmountUnit,
  density: number = defaultFoodDensity
) {
  if (amountUnit === "serving") return amount;
  if (amountUnit === basisUnit) return amount;

  const ml =
    amountUnit === "ml" ? amount :
    amountUnit === "tbsp" ? amount * mlPerTbsp :
    amountUnit === "tsp" ? amount * mlPerTsp :
    amountUnit === "cup" ? amount * mlPerCup :
    null;

  if (basisUnit === "ml") {
    if (ml !== null) return ml;
    const grams = amountUnit === "g" ? amount : amountUnit === "oz" ? amount * gramsPerOunce : null;
    return grams === null ? null : grams / density;
  }

  const grams =
    amountUnit === "g" ? amount :
    amountUnit === "oz" ? amount * gramsPerOunce :
    ml !== null ? ml * density :
    null;

  if (grams === null) return null;
  if (basisUnit === "g") return grams;
  if (basisUnit === "oz") return grams / gramsPerOunce;

  return null;
}

export function getScaleFromServingBasis(food: Pick<Food, "servingSize">, amount: number) {
  const basis = getMeasuredServingBasis(food);
  if (!basis) return null;

  return amount / basis.amount;
}

export function getServingSizeBasis(detail: FoodDetail | null, food: Food) {
  return (
    parseServingSize(detail?.servingSize, detail?.servingSizeUnit ?? "") ??
    parseServingSize(food.servingSize)
  );
}

export function hasUsableSearchNutrition(food: Food) {
  if (food.isSearchPreview) return false;

  const basis = getMeasuredServingBasis(food);
  return Boolean(basis && isGramUnit(basis.unit) && food.calories > 0);
}

export function getServingSizeLabel(detail: FoodDetail | null, food: Food) {
  const basis = getServingSizeBasis(detail, food);
  return basis ? `${basis.amount} ${basis.unit}`.trim() : food.servingSize;
}

export function scaleFoodNutrition(food: Food, factor: number, servingSize: string): Food {
  return {
    ...food,
    servingSize,
    calories: Math.round(food.calories * factor),
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: food.fiber === undefined ? undefined : food.fiber * factor,
    sugar: food.sugar === undefined ? undefined : food.sugar * factor,
    sodium: food.sodium === undefined ? undefined : food.sodium * factor,
  };
}

export function foodFromDetailNutrition(food: Food, detail: FoodDetail, servingSize: string): Food {
  return {
    ...food,
    isSearchPreview: false,
    servingSize,
    calories: Math.round(detail.nutrients?.calories ?? food.calories),
    protein: detail.nutrients?.protein ?? food.protein,
    carbs: detail.nutrients?.carbs ?? food.carbs,
    fat: detail.nutrients?.fat ?? food.fat,
    fiber: detail.nutrients?.fiber ?? food.fiber,
    sodium: detail.nutrients?.sodium ?? food.sodium,
  };
}

export function getFoodForSelectedPortion(
  food: Food,
  detail: FoodDetail | null,
  portion: PortionOption | undefined,
  amount: number
): Food {
  if (portion && detail) {
    const servingSize = portion.displayLabel ?? `${portion.label} (${formatGramWeightWithSpace(portion.gramWeight)})`;
    const portionScale = getScaleFromServingBasis(food, portion.gramWeight);
    const portionFood =
      portionScale !== null
        ? scaleFoodNutrition(food, portionScale, servingSize)
        : foodFromDetailNutrition(food, detail, servingSize);

    return {
      ...portionFood,
      calories: getCaloriesPerServing(food, detail, portion),
    };
  }

  const localScale =
    hasUsableSearchNutrition(food) && Number.isFinite(amount) && amount > 0
      ? getScaleFromServingBasis(food, amount)
      : null;

  if (localScale !== null) {
    return scaleFoodNutrition(food, localScale, formatLocalPortionAmount(food, amount));
  }

  if (detail) {
    const servingSize = getServingSizeLabel(detail, food);

    return {
      ...foodFromDetailNutrition(food, detail, servingSize),
      calories: getCaloriesPerServing(food, detail),
    };
  }

  return food;
}

export function getCaloriesPerServing(food: Food, detail: FoodDetail | null, portion?: PortionOption) {
  const labelCalories = getLabelCaloriesPerServing(detail);
  if (labelCalories !== null) return labelCalories;

  const caloriesPer100Units = getEnergyCaloriesPer100Units(detail);

  if (portion && caloriesPer100Units !== null) {
    return Math.round((caloriesPer100Units * portion.gramWeight) / 100);
  }

  const basis = getServingSizeBasis(detail, food);
  if (
    caloriesPer100Units !== null &&
    basis &&
    isGramUnit(basis.unit)
  ) {
    return Math.round((caloriesPer100Units * basis.amount) / 100);
  }

  return food.calories;
}

export function getModalResultCalories(
  food: Food,
  selectedFood: Food | null,
  selectedFoodDetail: FoodDetail | null,
  selectedPortion: PortionOption | undefined,
  isLoadingDetail: boolean
) {
  if (selectedFood?.id !== food.id) {
    if (food.isSearchPreview) {
      return {
        calories: 0,
        servingSize: "select to load nutrition",
        isLoading: false,
      };
    }

    return {
      calories: food.calories,
      servingSize: food.servingSize,
      isLoading: false,
    };
  }

  if (isLoadingDetail) {
    return {
      calories: food.calories,
      servingSize: food.servingSize,
      isLoading: true,
    };
  }

  if (selectedFoodDetail) {
    return {
      calories: getCaloriesPerServing(food, selectedFoodDetail, selectedPortion),
      servingSize: selectedPortion
        ? selectedPortion.displayLabel ?? `${selectedPortion.label} (${formatGramWeightWithSpace(selectedPortion.gramWeight)})`
        : getServingSizeLabel(selectedFoodDetail, food),
      isLoading: false,
    };
  }

  return {
    calories: food.calories,
    servingSize: food.servingSize,
    isLoading: false,
  };
}

export function getIngredientCalories(ingredient: RecipeIngredient) {
  return Math.round(ingredient.food.calories * ingredient.quantity);
}

export function getIngredientMacro(
  ingredient: RecipeIngredient,
  key: "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium"
) {
  return (ingredient.food[key] ?? 0) * ingredient.quantity;
}

export function getRecipeTotals(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (totals, ingredient) => ({
      calories: totals.calories + getIngredientCalories(ingredient),
      protein: totals.protein + getIngredientMacro(ingredient, "protein"),
      carbs: totals.carbs + getIngredientMacro(ingredient, "carbs"),
      fat: totals.fat + getIngredientMacro(ingredient, "fat"),
      fiber: totals.fiber + getIngredientMacro(ingredient, "fiber"),
      sugar: totals.sugar + getIngredientMacro(ingredient, "sugar"),
      sodium: totals.sodium + getIngredientMacro(ingredient, "sodium"),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
    }
  );
}

// Custom foods/recipes use negative IDs to stay distinct from USDA FDC IDs.
// -Date.now() alone collides when two items are created in the same millisecond.

export function parseRecipe(form: RecipeForm, ingredients: RecipeIngredient[]): Recipe | null {
  const name = form.name.trim();
  const servingSize = form.servingSize.trim();
  const servingUnit = form.servingUnit.trim();

  if (!name || !servingSize || !servingUnit || ingredients.length === 0) return null;

  const totals = getRecipeTotals(ingredients);

  return {
    id: createNegativeFoodId(),
    name: name.endsWith("- Recipe") ? name : `${name} - Recipe`,
    brand: "Recipe",
    servingSize: `${servingSize} ${servingUnit}`,
    calories: Math.round(totals.calories),
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    sugar: totals.sugar,
    sodium: totals.sodium,
    notes: form.notes.trim() || undefined,
    ingredients,
  };
}

export function foodToCustomFoodForm(food: Food): CustomFoodForm {
  const serving = parseServingSize(food.servingSize);

  return {
    name: food.name,
    brand: food.brand ?? "",
    servingSize: serving ? String(serving.amount) : food.servingSize,
    servingUnit: serving?.unit ?? "",
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
    fiber: String(food.fiber ?? 0),
    sugar: String(food.sugar ?? 0),
    sodium: String(food.sodium ?? 0),
    notes: food.notes ?? "",
  };
}

export function recipeToRecipeForm(recipe: Recipe): RecipeForm {
  const serving = parseServingSize(recipe.servingSize);

  return {
    name: recipe.name,
    servingSize: serving ? String(serving.amount) : recipe.servingSize,
    servingUnit: serving?.unit ?? "",
    notes: recipe.notes ?? "",
  };
}

export function parseCustomFood(form: CustomFoodForm): Food | null {
  const name = form.name.trim();
  const servingSize = form.servingSize.trim();
  const servingUnit = form.servingUnit.trim();
  const calories = parseDecimalInput(form.calories);
  const protein = parseDecimalInput(form.protein || "0");
  const carbs = parseDecimalInput(form.carbs || "0");
  const fat = parseDecimalInput(form.fat || "0");
  const fiber = parseDecimalInput(form.fiber || "0");
  const sugar = parseDecimalInput(form.sugar || "0");
  const sodium = parseDecimalInput(form.sodium || "0");

  if (!name || !servingSize || !servingUnit || !Number.isFinite(calories) || calories < 0) {
    return null;
  }

  if (![protein, carbs, fat, fiber, sugar, sodium].every((value) => Number.isFinite(value) && value >= 0)) {
    return null;
  }

  return {
    id: createNegativeFoodId(),
    name,
    brand: form.brand.trim() || null,
    servingSize: `${servingSize} ${servingUnit}`,
    calories: Math.round(calories),
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
    notes: form.notes.trim() || undefined,
  };
}

export function normalizeOcrText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseOcrNumber(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[oO]/g, "0");
  const fractionMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);

  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    return denominator ? numerator / denominator : null;
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function formatScannedNumber(value: number, decimals = 1) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(decimals)));
}

export function getNutritionLine(text: string, labelPattern: RegExp) {
  return text.split("\n").find((line) => labelPattern.test(line.toLowerCase())) ?? "";
}

export function extractNutritionAmount(text: string, labelPattern: RegExp, unit: "g" | "mg" | "any" = "g") {
  const line = getNutritionLine(text, labelPattern);
  if (!line) return "";

  const amountMatch =
    unit === "mg"
      ? line.match(/(\d+(?:[.,]\d+)?)\s*(mg|g)\b/i)
      : unit === "g"
        ? line.match(/(\d+(?:[.,]\d+)?)\s*g\b/i)
        : line.match(/(\d+(?:[.,]\d+)?)/);

  if (!amountMatch) return "";

  const amount = parseOcrNumber(amountMatch[1].replace(",", "."));
  if (amount === null) return "";

  if (unit === "mg" && amountMatch[2]?.toLowerCase() === "g") {
    return formatScannedNumber(amount * 1000, 0);
  }

  return formatScannedNumber(amount, unit === "mg" ? 0 : 1);
}

export function extractCalories(text: string) {
  const line = getNutritionLine(text, /\bcalories\b/);
  const match = line.match(/\bcalories\b\D{0,12}(\d{1,4})\b/i) ?? line.match(/\b(\d{1,4})\b/);
  const calories = match ? parseOcrNumber(match[1]) : null;

  return calories === null ? "" : formatScannedNumber(calories, 0);
}

export function extractServingSize(text: string) {
  const line = getNutritionLine(text, /\bserving size\b/);
  if (!line) return {};

  const servingText = line.replace(/.*?\bserving size\b[:\s]*/i, "").trim();
  const parenGramMatch = servingText.match(/\((\d+(?:[.,]\d+)?)\s*(g|ml|mL)\)/);
  const amountUnitMatch = servingText.match(
    /(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)\s*(cup|cups|tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons|piece|pieces|bar|bars|slice|slices|container|package|packet|pouch|bottle|can|serving|g|gram|grams|ml|mL|oz|ounce|ounces)\b/i
  );

  if (amountUnitMatch) {
    return {
      servingSize: amountUnitMatch[1].replace(/\s+/g, ""),
      servingUnit: amountUnitMatch[2],
    };
  }

  if (parenGramMatch) {
    return {
      servingSize: parenGramMatch[1].replace(",", "."),
      servingUnit: parenGramMatch[2],
    };
  }

  return {};
}

export function parseNutritionLabelText(text: string): ScannedNutritionFields {
  const normalizedText = normalizeOcrText(text);

  return {
    ...extractServingSize(normalizedText),
    calories: extractCalories(normalizedText),
    fat: extractNutritionAmount(normalizedText, /\btotal fat\b/),
    carbs: extractNutritionAmount(normalizedText, /\b(total carbohydrate|total carbs|carbohydrate)\b/),
    protein: extractNutritionAmount(normalizedText, /\bprotein\b/),
    sugar: extractNutritionAmount(normalizedText, /\b(total sugars|sugars|sugar)\b/),
    fiber: extractNutritionAmount(normalizedText, /\b(dietary fiber|fiber)\b/),
    sodium: extractNutritionAmount(normalizedText, /\bsodium\b/, "mg"),
  };
}

const recipeIngredientUnit = /\b(cups?|tbsps?|tbs|tablespoons?|tsps?|teaspoons?|ounces?|oz|grams?|kg|kilograms?|ml|millilit(?:er|re)s?|lit(?:er|re)s?|pounds?|lbs?|cloves?|pinch(?:es)?|cans?|slices?|sticks?|sprigs?|packages?|pkg|quarts?|pints?|handfuls?|dash(?:es)?)\b/i;
const recipeLeadingQuantity = /^(?:\d+[\d/.\s¼½¾⅓⅔⅛⅜⅝⅞-]*|[¼½¾⅓⅔⅛⅜⅝⅞])/;
const recipeNonNameWords = /(nutrition|calorie|protein|carb|fat\b|sugar|fiber|sodium|serving|ingredient|direction|instruction|method|step\b|prep\b|cook\b|total time|yield|servings)/i;

/**
 * Best-effort parse of a recipe screenshot's OCR text into name, ingredient
 * lines, and any visible per-serving macros. Heuristic and lossy by nature —
 * the user reviews and edits the result before saving.
 */
export function parseRecipeScreenshotText(rawText: string): ScannedRecipeFields {
  const text = normalizeOcrText(rawText);
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  const ingredients = lines
    .map((line) => line.replace(/^[^\p{L}\p{N}]+/u, "").trim())
    .filter((line) => {
      if (line.length < 3 || line.length > 90) return false;
      return recipeLeadingQuantity.test(line) || recipeIngredientUnit.test(line);
    });

  const letterRatio = (line: string) => (line.match(/[a-z]/gi)?.length ?? 0) / line.length;
  const name =
    lines.find(
      (line) =>
        line.length >= 3 &&
        line.length <= 60 &&
        letterRatio(line) >= 0.5 &&
        !recipeNonNameWords.test(line) &&
        !recipeLeadingQuantity.test(line)
    ) ?? "";

  const macros = parseNutritionLabelText(text);

  return {
    name,
    ingredients,
    calories: macros.calories,
    protein: macros.protein,
    carbs: macros.carbs,
    fat: macros.fat,
  };
}

const recipeIngredientUnitGlobal = new RegExp(recipeIngredientUnit.source, "gi");
const recipeIngredientPrepWords = /\b(of|fresh|chopped|diced|minced|sliced|grated|shredded|crushed|ground|to taste|optional|finely|roughly|large|small|medium)\b/gi;

/** Strip quantities, units, and prep words from an ingredient line to get a searchable food name. */
export function recipeIngredientSearchTerm(line: string): string {
  return line
    .replace(/\([^)]*\)/g, " ")
    .replace(/^\s*[\d/.\s¼½¾⅓⅔⅛⅜⅝⅞-]+/, " ")
    .split(",")[0]
    .replace(recipeIngredientUnitGlobal, " ")
    .replace(recipeIngredientPrepWords, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Unit choices for entering an amount of a food, by its measurement type (mirrors the log editor). */
export function getAmountUnitsForFood(food: Pick<Food, "measurementType">): AmountUnit[] {
  if (food.measurementType === "liquid") return ["ml", "cup", "tbsp", "tsp", "serving"];
  if (food.measurementType === "spoonable") return ["g", "oz", "cup", "tbsp", "tsp", "serving"];
  return ["g", "oz", "cup", "tbsp", "tsp", "serving"];
}

const ingredientUnitMap: Record<string, { unit: AmountUnit; factor: number }> = {
  tbsp: { unit: "tbsp", factor: 1 }, tbsps: { unit: "tbsp", factor: 1 }, tbs: { unit: "tbsp", factor: 1 },
  tablespoon: { unit: "tbsp", factor: 1 }, tablespoons: { unit: "tbsp", factor: 1 },
  tsp: { unit: "tsp", factor: 1 }, tsps: { unit: "tsp", factor: 1 }, teaspoon: { unit: "tsp", factor: 1 }, teaspoons: { unit: "tsp", factor: 1 },
  cup: { unit: "cup", factor: 1 }, cups: { unit: "cup", factor: 1 },
  ml: { unit: "ml", factor: 1 }, milliliter: { unit: "ml", factor: 1 }, milliliters: { unit: "ml", factor: 1 },
  l: { unit: "ml", factor: 1000 }, liter: { unit: "ml", factor: 1000 }, liters: { unit: "ml", factor: 1000 }, litre: { unit: "ml", factor: 1000 }, litres: { unit: "ml", factor: 1000 },
  g: { unit: "g", factor: 1 }, gram: { unit: "g", factor: 1 }, grams: { unit: "g", factor: 1 },
  kg: { unit: "g", factor: 1000 }, kilogram: { unit: "g", factor: 1000 }, kilograms: { unit: "g", factor: 1000 },
  oz: { unit: "oz", factor: 1 }, ounce: { unit: "oz", factor: 1 }, ounces: { unit: "oz", factor: 1 },
  lb: { unit: "oz", factor: 16 }, lbs: { unit: "oz", factor: 16 }, pound: { unit: "oz", factor: 16 }, pounds: { unit: "oz", factor: 16 },
};

const unicodeFractions: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

function parseAmountToken(raw: string): number | null {
  let token = raw.trim();
  if (!token) return null;
  for (const [glyph, value] of Object.entries(unicodeFractions)) token = token.split(glyph).join(` ${value} `);
  const parts = token.split(/\s+/).filter(Boolean);
  let total = 0;
  let matched = false;
  for (const part of parts) {
    const fraction = part.match(/^(\d+)\/(\d+)$/);
    if (fraction) {
      const denominator = Number(fraction[2]);
      if (!denominator) return null;
      total += Number(fraction[1]) / denominator;
      matched = true;
    } else if (/^\d+(\.\d+)?$/.test(part)) {
      total += parseFloat(part);
      matched = true;
    } else {
      return null;
    }
  }
  return matched ? total : null;
}

/** Pull a leading "8 Tbsp" / "2 1/4 lbs" / "1 1/2 tsp" amount+unit off an ingredient line (lb→oz, kg→g, l→ml). */
export function parseIngredientAmount(line: string): { amount: number; unit: AmountUnit } | null {
  const match = line.trim().match(/^([^a-zA-Z]*?)\s*([a-zA-Z]+)/);
  if (!match) return null;
  const amount = parseAmountToken(match[1]);
  if (amount === null) return null;
  const mapped = ingredientUnitMap[match[2].toLowerCase()];
  if (!mapped) return null;
  return { amount: amount * mapped.factor, unit: mapped.unit };
}

/** Convert an amount + unit of a food into a RecipeIngredient quantity (a multiplier of the food's serving). */
export function ingredientServingsFromAmount(food: Food, amount: number, unit: AmountUnit): number | null {
  if (unit === "serving") return amount;
  const basis = getMeasuredServingBasis(food);
  if (!basis || !basis.amount) return null;
  const inBasis = convertAmountToBasisUnit(amount, unit, basis.unit, getFoodDensity(food));
  if (inBasis === null) return null;
  return inBasis / basis.amount;
}
