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
  food: Pick<Food, "name" | "dataType" | "measurementType" | "servingSize" | "amount" | "amountUnit" | "portionLabel" | "servingLabel">,
  servingSize = food.servingSize
) {
  const explicitDisplay = getFoodServingDisplay({ ...food, servingSize });
  const normalizedServing = servingSize.trim().toLowerCase().replace(/\s+/g, "");

  if (explicitDisplay !== servingSize && explicitDisplay !== "100g") return explicitDisplay;

  const typical = getSearchTypicalServing({ ...food, servingSize });
  if (typical) return formatTypicalServingDisplay(typical);

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

  const typical = getSearchTypicalServing({ ...food, servingSize });
  if (typical && serving === formatTypicalServingDisplay(typical)) {
    return { calories: Math.round((calories * typical.gramWeight) / 100), serving };
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

/** Trim a USDA FoodDetail down to what portion/calorie math needs, so it can be
 * stored on a saved food in localStorage. Keeps serving/label/portion data and a
 * single synthetic Energy entry; drops the full micronutrient list. */
export function toStorableFoodDetail(detail: FoodDetail): FoodDetail {
  const energyPer100 = getEnergyCaloriesPer100Units(detail);

  return {
    id: detail.id,
    name: detail.name,
    brand: detail.brand ?? null,
    category: detail.category ?? null,
    dataType: detail.dataType ?? null,
    servingSize: detail.servingSize ?? null,
    servingSizeValue: detail.servingSizeValue ?? null,
    servingSizeUnit: detail.servingSizeUnit ?? null,
    householdServingFullText: detail.householdServingFullText ?? null,
    labelNutrients: detail.labelNutrients ?? null,
    nutrients: detail.nutrients,
    foodPortions: detail.foodPortions ?? [],
    foodNutrients:
      energyPer100 !== null ? [{ nutrientName: "Energy", unitName: "kcal", amount: energyPer100 }] : [],
  };
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

  // Volume units that need conversion, checked before the plain-unit pattern:
  // "12 fl oz" would otherwise parse as unit "fl", and liters aren't a
  // MeasuredAmountUnit — both convert to ml here so downstream math is unchanged.
  const flOzMeasure = trimmedValue.match(/([\d.]+)\s*(?:fl\.?\s*oz\.?|fluid\s+ounces?)\b/i);
  if (flOzMeasure) {
    const amount = Number(flOzMeasure[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { amount: Math.round(amount * 29.5735 * 10) / 10, unit: "ml" };
    }
  }
  const literMeasure = trimmedValue.match(/([\d.]+)\s*(?:liters?|litres?|l)\b/i);
  if (literMeasure) {
    const amount = Number(literMeasure[1]);
    if (Number.isFinite(amount) && amount > 0) {
      return { amount: amount * 1000, unit: "ml" };
    }
  }

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

// Typical household servings for foods whose only serving is "100 g" (the local DB and
// USDA generic entries), so lists can read "per medium apple (182g)" instead of "per 100 g".
// Gram weights are FNDDS/label-style approximations for at-a-glance display; the portion
// picker in the add flow remains the precise path. First matching rule wins, so specific
// rules must come before the general ones they overlap ("sweet potato" before "potato",
// "bun" before "hot dog", fish canned in oil before "oil"). Keywords match whole words,
// tolerating plain plurals ("carrot" ~ "carrots", "cherry" ~ "cherries").
export const typicalServingRules: [keyword: string, gramWeight: number, label: string][] = [
  // Compound names and overrides that must beat a broader rule below
  ["soup", 245, "1 cup"],
  ["broth", 240, "1 cup"],
  ["stock", 240, "1 cup"],
  ["mushroom", 70, "1 cup sliced"],
  ["lemon juice", 15, "1 tbsp"],
  ["lime juice", 15, "1 tbsp"],
  ["juice", 240, "1 cup"],
  ["smoothie", 240, "1 cup"],
  ["shake", 245, "1 cup"],
  ["espresso", 30, "1 shot"],
  ["lemonade", 240, "1 cup"],
  ["kombucha", 240, "1 cup"],
  ["kefir", 243, "1 cup"],
  ["buttermilk", 245, "1 cup"],
  ["coconut water", 240, "1 cup"],
  ["sparkling water", 355, "12 oz can"],
  ["seltzer", 355, "12 oz can"],
  ["gatorade", 355, "12 oz bottle"],
  ["energy drink", 250, "1 can"],
  ["vodka", 42, "1 shot"],
  ["whiskey", 42, "1 shot"],
  ["tequila", 42, "1 shot"],
  ["rum", 42, "1 shot"],
  ["gin", 42, "1 shot"],
  ["baking soda", 5, "1 tsp"],
  ["baking powder", 4, "1 tsp"],
  ["cocoa", 5, "1 tbsp"],
  ["coconut sugar", 4, "1 tsp"],
  ["cornstarch", 8, "1 tbsp"],
  ["cream of tartar", 3, "1 tsp"],
  ["yeast", 7, "1 packet"],
  ["extract", 4, "1 tsp"],
  ["creamer", 15, "1 tbsp"],
  ["coffee", 240, "1 cup"],
  ["tea", 240, "1 cup"],
  ["vinaigrette", 30, "2 tbsp"],
  ["vinegar", 15, "1 tbsp"],
  ["beer", 356, "12 oz can"],
  ["wine", 147, "5 oz glass"],
  ["soda", 368, "12 oz can"],
  ["cola", 368, "12 oz can"],
  ["chocolate milk", 250, "1 cup"],
  ["coconut milk", 80, "1/3 cup"],
  ["milk chocolate", 42, "1 bar"],
  ["condensed milk", 39, "2 tbsp"],
  ["evaporated milk", 32, "2 tbsp"],
  ["protein powder", 31, "1 scoop"],
  ["powder", 3, "1 tsp"],
  ["seasoning", 3, "1 tsp"],
  ["protein bar", 50, "1 bar"],
  ["trail mix", 38, "1/4 cup"],
  ["gummy", 40, "1 small bag"],
  ["pickle", 35, "1 spear"],
  ["ricotta", 62, "1/4 cup"],
  ["mascarpone", 28, "2 tbsp"],
  ["half-and-half", 30, "2 tbsp"],
  ["skyr", 170, "1 container"],
  ["ice cream", 66, "1/2 cup"],
  ["frozen yogurt", 87, "1/2 cup"],
  ["sour cream", 30, "2 tbsp"],
  ["cream cheese", 28, "2 tbsp"],
  ["cottage cheese", 113, "1/2 cup"],
  ["mac and cheese", 190, "1 cup prepared"],
  ["taco sauce", 30, "2 tbsp"],
  ["aioli", 14, "1 tbsp"],
  ["meatloaf", 112, "1 slice"],
  ["pizza", 107, "1 slice"],
  ["sandwich", 150, "1 sandwich"],
  ["burrito", 217, "1 burrito"],
  ["taco", 102, "1 taco"],
  // Composite salads: these are multi-ingredient dishes, so they must beat the
  // single-ingredient rules below (a potato salad is not measured in "medium
  // potatoes", nor an egg salad in "large eggs"). Kept below "sandwich" so
  // "chicken salad sandwich" still reads as a sandwich, and specific enough that
  // "salad dressing" falls through to the dressing rule.
  ["potato salad", 125, "1/2 cup"],
  ["macaroni salad", 120, "1/2 cup"],
  ["pasta salad", 120, "1/2 cup"],
  ["egg salad", 110, "1/2 cup"],
  ["tuna salad", 102, "1/2 cup"],
  ["chicken salad", 120, "1/2 cup"],
  ["ham salad", 110, "1/2 cup"],
  ["seafood salad", 115, "1/2 cup"],
  ["crab salad", 115, "1/2 cup"],
  ["bean salad", 120, "1/2 cup"],
  ["coleslaw", 90, "1/2 cup"],
  ["cole slaw", 90, "1/2 cup"],
  ["fruit salad", 175, "1 cup"],
  ["caesar salad", 100, "1 cup"],
  ["cobb salad", 120, "1 cup"],
  ["garden salad", 70, "1 cup"],
  ["green salad", 70, "1 cup"],
  ["side salad", 70, "1 cup"],
  ["fries", 117, "1 medium serving"],
  ["hash brown", 72, "1 patty"],
  ["chip", 28, "1 oz"],
  ["tortilla", 45, "1 tortilla"],
  ["flour", 30, "1/4 cup"],
  ["english muffin", 57, "1 muffin"],
  ["muffin", 113, "1 muffin"],
  ["rice cake", 9, "1 cake"],
  ["granola bar", 24, "1 bar"],
  ["cookie", 30, "2 cookies"],
  ["brownie", 40, "1 brownie"],
  ["donut", 60, "1 donut"],
  ["doughnut", 60, "1 doughnut"],
  ["cake", 80, "1 slice"],
  ["pie", 125, "1 slice"],
  ["banana bread", 60, "1 slice"],
  ["french toast", 65, "1 slice"],
  ["bun", 46, "1 bun"],
  ["noodle", 160, "1 cup cooked"],
  ["pretzel", 28, "1 oz"],
  ["popcorn", 24, "3 cups popped"],
  ["cereal", 30, "1 cup"],
  ["egg white", 33, "1 large white"],
  ["egg yolk", 17, "1 yolk"],
  ["green bean", 125, "1 cup"],
  ["bean sprout", 52, "1/2 cup"],
  ["sweet potato", 130, "1 medium"],
  ["bell pepper", 119, "1 medium pepper"],
  ["jalapeno", 14, "1 pepper"],
  ["dried apricot", 35, "5 dried apricots"],
  ["cranberries, dried", 40, "1/4 cup"],
  ["figs, dried", 28, "1/4 cup"],
  ["sun-dried tomato", 27, "1/4 cup"],
  ["canned tomato", 121, "1/2 cup"],
  ["tomato paste", 16, "1 tbsp"],
  ["applesauce", 122, "1/2 cup"],
  ["guacamole", 30, "2 tbsp"],
  ["hummus", 30, "2 tbsp"],
  ["peanut butter", 32, "2 tbsp"],
  ["almond butter", 32, "2 tbsp"],
  ["chia", 24, "2 tbsp"],
  ["flax", 10, "1 tbsp"],
  ["flaxseed", 10, "1 tbsp"],
  // Sauces and condiments
  ["tomato sauce", 122, "1/2 cup"],
  ["marinara", 125, "1/2 cup"],
  ["alfredo", 62, "1/4 cup"],
  ["pesto", 16, "1 tbsp"],
  ["salsa", 36, "2 tbsp"],
  ["pico de gallo", 36, "2 tbsp"],
  ["sriracha", 5, "1 tsp"],
  ["tamari", 16, "1 tbsp"],
  ["aminos", 5, "1 tsp"],
  ["tzatziki", 30, "2 tbsp"],
  ["chimichurri", 15, "1 tbsp"],
  ["miracle whip", 15, "1 tbsp"],
  ["tahini", 15, "1 tbsp"],
  ["miso", 17, "1 tbsp"],
  ["molasses", 20, "1 tbsp"],
  ["agave", 21, "1 tbsp"],
  ["soy sauce", 16, "1 tbsp"],
  ["hot sauce", 5, "1 tsp"],
  ["bbq sauce", 36, "2 tbsp"],
  ["barbecue sauce", 36, "2 tbsp"],
  ["teriyaki", 18, "1 tbsp"],
  ["mustard", 5, "1 tsp"],
  ["ketchup", 17, "1 tbsp"],
  ["mayonnaise", 13, "1 tbsp"],
  ["mayo", 13, "1 tbsp"],
  ["relish", 15, "1 tbsp"],
  ["dressing", 30, "2 tbsp"],
  ["gravy", 57, "1/4 cup"],
  ["syrup", 20, "1 tbsp"],
  ["honey", 21, "1 tbsp"],
  ["jam", 20, "1 tbsp"],
  ["jelly", 20, "1 tbsp"],
  ["sauce", 30, "2 tbsp"],
  // Seafood and meat (fish before "oil" so "canned in oil" doesn't read as oil)
  ["sardine", 92, "1 can drained"],
  ["anchovy", 20, "5 fillets"],
  ["tuna", 85, "3 oz"],
  ["salmon", 113, "4 oz"],
  ["cod", 90, "1 fillet"],
  ["tilapia", 87, "1 fillet"],
  ["halibut", 85, "3 oz"],
  ["trout", 85, "3 oz"],
  ["mahi", 85, "3 oz"],
  ["catfish", 85, "3 oz"],
  ["herring", 85, "3 oz"],
  ["shrimp", 85, "3 oz"],
  ["scallop", 85, "3 oz"],
  ["crab", 85, "3 oz"],
  ["lobster", 85, "3 oz"],
  ["clam", 85, "3 oz"],
  ["oyster", 85, "3 oz"],
  ["mussel", 85, "3 oz"],
  ["chicken breast", 172, "1 breast"],
  ["chicken thigh", 111, "1 thigh"],
  ["chicken drumstick", 72, "1 drumstick"],
  ["chicken wing", 34, "1 wing"],
  ["chicken", 85, "3 oz"],
  ["turkey breast", 85, "3 oz"],
  ["deli", 56, "2 oz"],
  ["bacon", 12, "1 slice"],
  ["ham", 85, "3 oz"],
  ["hot dog", 45, "1 hot dog"],
  ["sausage", 68, "1 link"],
  ["bratwurst", 85, "1 link"],
  ["kielbasa", 85, "3 oz"],
  ["salami", 28, "1 oz"],
  ["pepperoni", 28, "1 oz"],
  ["bologna", 28, "1 slice"],
  ["prosciutto", 28, "1 oz"],
  ["spam", 56, "2 oz"],
  ["jerky", 28, "1 oz"],
  ["ground beef", 85, "3 oz"],
  ["steak", 85, "3 oz"],
  ["beef", 85, "3 oz"],
  ["pork rind", 14, "1/2 oz"],
  ["pork chop", 137, "1 chop"],
  ["pork", 85, "3 oz"],
  ["lamb", 85, "3 oz"],
  ["turkey", 85, "3 oz"],
  ["bison", 85, "3 oz"],
  ["venison", 85, "3 oz"],
  ["duck", 85, "3 oz"],
  ["rabbit", 85, "3 oz"],
  ["veal", 85, "3 oz"],
  ["tofu", 85, "3 oz"],
  ["tempeh", 84, "3 oz"],
  ["seitan", 85, "3 oz"],
  ["natto", 88, "1/2 cup"],
  ["egg", 50, "1 large egg"],
  // Oils (after meats, before produce so "olive oil" and "avocado oil" stay a tbsp)
  ["oil", 14, "1 tbsp"],
  // Vegetables and fruits
  ["avocado", 75, "1/2 medium"],
  ["olive", 15, "5 olives"],
  ["broccoli", 91, "1 cup chopped"],
  ["carrot", 61, "1 medium carrot"],
  ["scallion", 15, "1 scallion"],
  ["onion", 110, "1 medium onion"],
  ["garlic", 3, "1 clove"],
  ["spinach", 30, "1 cup raw"],
  ["lettuce", 55, "1 cup shredded"],
  ["kale", 21, "1 cup"],
  ["arugula", 20, "1 cup"],
  ["cucumber", 104, "1 cup sliced"],
  ["zucchini", 124, "1 cup sliced"],
  ["butternut squash", 205, "1 cup cubed"],
  ["squash", 130, "1 cup sliced"],
  ["pumpkin seed", 28, "1 oz"],
  ["pumpkin", 245, "1 cup"],
  ["potato", 173, "1 medium potato"],
  ["black-eyed pea", 86, "1/2 cup cooked"],
  ["split pea", 98, "1/2 cup cooked"],
  ["pea", 145, "1 cup"],
  ["corn", 154, "1 cup"],
  ["cabbage", 89, "1 cup shredded"],
  ["cauliflower", 107, "1 cup"],
  ["brussels sprout", 88, "1 cup"],
  ["asparagus", 90, "6 spears"],
  ["celery", 40, "1 stalk"],
  ["radish", 116, "1 cup sliced"],
  ["beet", 136, "1 cup"],
  ["eggplant", 82, "1 cup cubed"],
  ["turnip", 130, "1 cup cubed"],
  ["leek", 89, "1 leek"],
  ["shallot", 40, "1 shallot"],
  ["bok choy", 70, "1 cup"],
  ["chard", 36, "1 cup"],
  ["collard", 36, "1 cup"],
  ["okra", 100, "1 cup"],
  ["artichoke heart", 84, "1/2 cup"],
  ["artichoke", 120, "1 medium"],
  ["fennel", 87, "1 cup sliced"],
  ["parsnip", 133, "1 cup sliced"],
  ["rutabaga", 140, "1 cup cubed"],
  ["watercress", 34, "1 cup"],
  ["endive", 50, "1 cup"],
  ["sauerkraut", 71, "1/2 cup"],
  ["kimchi", 75, "1/2 cup"],
  ["roasted red pepper", 38, "1/4 cup"],
  ["plantain", 137, "1 cup sliced"],
  ["cassava", 103, "1/2 cup"],
  ["yam", 136, "1 cup cubed"],
  ["tomato", 123, "1 medium tomato"],
  ["apple", 182, "1 medium apple"],
  ["banana", 118, "1 medium banana"],
  ["orange", 131, "1 medium orange"],
  ["strawberry", 152, "1 cup"],
  ["blueberry", 148, "1 cup"],
  ["raspberry", 123, "1 cup"],
  ["blackberry", 144, "1 cup"],
  ["cherry", 138, "1 cup"],
  ["berry", 140, "1 cup"],
  ["grapefruit", 123, "1/2 grapefruit"],
  ["grape", 151, "1 cup"],
  ["watermelon", 152, "1 cup diced"],
  ["cantaloupe", 156, "1 cup"],
  ["honeydew", 170, "1 cup"],
  ["pineapple", 165, "1 cup chunks"],
  ["mango", 165, "1 cup"],
  ["peach", 150, "1 medium peach"],
  ["nectarine", 142, "1 medium"],
  ["pear", 178, "1 medium pear"],
  ["plum", 66, "1 plum"],
  ["kiwi", 69, "1 kiwi"],
  ["pomegranate", 87, "1/2 cup arils"],
  ["papaya", 145, "1 cup"],
  ["guava", 55, "1 guava"],
  ["passionfruit", 18, "1 fruit"],
  ["dragon fruit", 100, "1/2 fruit"],
  ["persimmon", 168, "1 fruit"],
  ["cranberry", 100, "1 cup"],
  ["coconut", 28, "1 oz shredded"],
  ["apricot", 35, "1 apricot"],
  ["fig", 50, "1 large fig"],
  ["date", 24, "1 medjool date"],
  ["raisin", 40, "1/4 cup"],
  ["prune", 40, "4 prunes"],
  ["tangerine", 88, "1 medium"],
  ["clementine", 74, "1 clementine"],
  ["mandarin", 76, "1 medium"],
  ["lemon", 58, "1 lemon"],
  ["lime", 67, "1 lime"],
  // Beans and legumes (before "butter" so "butter beans" stay beans)
  ["chickpea", 82, "1/2 cup cooked"],
  ["lentil", 99, "1/2 cup cooked"],
  ["edamame", 78, "1/2 cup shelled"],
  ["soybean", 86, "1/2 cup cooked"],
  ["bean", 86, "1/2 cup cooked"],
  // Dairy (milk before the oat/almond rules so "oat milk" stays a cup)
  ["yogurt", 170, "1 container"],
  ["milk", 244, "1 cup"],
  ["parmesan", 5, "1 tbsp grated"],
  ["cheddar", 28, "1 oz"],
  ["mozzarella", 28, "1 oz"],
  ["feta", 28, "1 oz"],
  ["brie", 28, "1 oz"],
  ["gouda", 28, "1 oz"],
  ["provolone", 28, "1 oz"],
  ["havarti", 28, "1 oz"],
  ["muenster", 28, "1 oz"],
  ["colby", 28, "1 oz"],
  ["monterey jack", 28, "1 oz"],
  ["camembert", 28, "1 oz"],
  ["romano", 28, "1 oz"],
  ["paneer", 28, "1 oz"],
  ["queso fresco", 28, "1 oz"],
  ["cheese", 28, "1 oz"],
  ["ghee", 13, "1 tbsp"],
  // Grains and bakery
  ["cracker", 16, "5 crackers"],
  ["oatmeal", 234, "1 cup cooked"],
  ["oat", 234, "1 cup cooked"],
  ["rice", 158, "1 cup cooked"],
  ["pasta", 140, "1 cup cooked"],
  ["spaghetti", 140, "1 cup cooked"],
  ["quinoa", 185, "1 cup cooked"],
  ["couscous", 157, "1 cup cooked"],
  ["barley", 157, "1 cup cooked"],
  ["grits", 242, "1 cup cooked"],
  ["farro", 170, "1 cup cooked"],
  ["bulgur", 182, "1 cup cooked"],
  ["millet", 174, "1 cup cooked"],
  ["polenta", 240, "1 cup cooked"],
  ["cornmeal", 240, "1 cup cooked"],
  ["buckwheat", 168, "1 cup cooked"],
  ["sorghum", 192, "1 cup cooked"],
  ["amaranth", 246, "1 cup cooked"],
  ["pita", 64, "1 pita"],
  ["bagel", 105, "1 bagel"],
  ["naan", 90, "1 piece"],
  ["croissant", 57, "1 croissant"],
  ["pancake", 38, "1 pancake"],
  ["waffle", 75, "1 waffle"],
  ["granola", 50, "1/2 cup"],
  ["bread", 32, "1 slice"],
  // Nuts and seeds
  ["peanut", 28, "1 oz"],
  ["almond", 28, "1 oz"],
  ["cashew", 28, "1 oz"],
  ["walnut", 28, "1 oz"],
  ["pecan", 28, "1 oz"],
  ["pistachio", 28, "1 oz"],
  ["macadamia", 28, "1 oz"],
  ["hazelnut", 28, "1 oz"],
  ["nut", 28, "1 oz"],
  ["seed", 28, "1 oz"],
  // Sweets, baking, and generic fallbacks
  ["chocolate", 42, "1 bar"],
  ["butter", 14, "1 tbsp"],
  ["cream", 15, "1 tbsp"],
  ["sugar", 4, "1 tsp"],
  // Herbs, spices, and a generic "ground" spice fallback (ground meats all match above)
  ["chicory", 30, "1 cup"],
  ["paprika", 2, "1 tsp"],
  ["oregano", 1, "1 tsp"],
  ["basil", 2, "1 tsp"],
  ["thyme", 1, "1 tsp"],
  ["rosemary", 1, "1 tsp"],
  ["cayenne", 2, "1 tsp"],
  ["red pepper flake", 2, "1 tsp"],
  ["garam masala", 2, "1 tsp"],
  ["salt", 6, "1 tsp"],
  ["ground", 2, "1 tsp"],
];

export type TypicalServing = { gramWeight: number; label: string };

function typicalServingPattern(keyword: string) {
  const escaped = escapeRegExp(keyword);
  const pattern = escaped.endsWith("y") ? `${escaped.slice(0, -1)}(?:y|ies)` : `${escaped}(?:e?s)?`;
  return new RegExp(`\\b${pattern}\\b`);
}

const typicalServingMatchers = typicalServingRules.map(([keyword, gramWeight, label]) => ({
  pattern: typicalServingPattern(keyword),
  gramWeight,
  label,
}));

export function getTypicalServing(food: Pick<Food, "name">): TypicalServing | null {
  const name = food.name.toLowerCase();
  const match = typicalServingMatchers.find(({ pattern, label }) =>
    // Never pin a "cooked" serving onto a dry/raw entry (dry rice vs cooked rice).
    !(/\bcooked\b/.test(label) && /\b(?:raw|dry|dried|uncooked)\b/.test(name)) &&
    pattern.test(name)
  );
  return match ? { gramWeight: match.gramWeight, label: match.label } : null;
}

const typicalServingDataTypes = new Set(["local", "foundation", "sr legacy", "survey (fndds)"]);

/** Typical serving for list rows: only foods whose serving is exactly per-100 g/ml qualify
 * (the local DB and non-branded USDA entries) — branded foods keep their label serving. */
export function getSearchTypicalServing(
  food: Pick<Food, "name" | "dataType" | "servingSize">
): TypicalServing | null {
  if (!typicalServingDataTypes.has(food.dataType?.toLowerCase() ?? "")) return null;

  const normalizedServing = food.servingSize.trim().toLowerCase().replace(/\s+/g, "");
  if (normalizedServing !== "100g" && normalizedServing !== "100ml") return null;

  return getTypicalServing(food);
}

export function formatTypicalServingDisplay(typical: TypicalServing) {
  const label = typical.label.replace(/^1 /, "");
  return `${label} (${formatGramWeight(typical.gramWeight)})`;
}

/** Rescale a per-100 g food to its typical serving for display/logging; returns the food
 * unchanged when no typical serving applies. */
export function applyTypicalServing(food: Food): Food {
  const typical = getSearchTypicalServing(food);
  return typical
    ? scaleFoodNutrition(food, typical.gramWeight / 100, formatTypicalServingDisplay(typical))
    : food;
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
      // Previews now carry estimated nutrition from the search response — show it so
      // results can be compared at a glance. Zero means the record had no usable estimate.
      if (food.calories > 0) {
        return {
          calories: food.calories,
          servingSize: food.servingSize,
          isLoading: false,
        };
      }
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
