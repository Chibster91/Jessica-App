import { useEffect, useState } from "react";
import "./App.css";

type Food = {
  id: number;
  name: string;
  brand: string | null;
  dataType?: string | null;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  notes?: string;
};

type RecipeIngredient = {
  food: Food;
  quantity: number;
};

type Recipe = Food & {
  ingredients: RecipeIngredient[];
};

type FoodPortion = {
  id?: number | string;
  amount?: number | null;
  modifier?: string | null;
  gramWeight?: number | null;
  measureUnit?: {
    name?: string | null;
    abbreviation?: string | null;
  } | null;
};

type FoodNutrient = {
  amount?: number;
  value?: number;
  nutrientName?: string;
  unitName?: string;
  nutrient?: {
    name?: string;
    unitName?: string;
  };
};

type FoodDetail = {
  dataType?: string | null;
  servingSize?: number | string | null;
  servingSizeUnit?: string | null;
  labelNutrients?: {
    calories?: {
      value?: number | null;
    } | null;
  } | null;
  foodPortions?: FoodPortion[];
  foodNutrients?: FoodNutrient[];
  nutrients?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sodium?: number;
  };
};

type PortionOption = {
  value: string;
  label: string;
  gramWeight: number;
};

type AddFoodTab = "search" | "recent" | "custom" | "recipes";

type AppView = "home" | "day" | "library" | "profile";

type FoodLibraryTab = "recent" | "custom" | "recipes";

type Sex = "female" | "male";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

type GoalType = "lose" | "maintain" | "gain";

type GoalRate = "mild" | "moderate" | "aggressive";

type HeightUnit = "ftIn" | "cm" | "in";

type WeightUnit = "kg" | "lb";

type LibrarySelection =
  | { type: "recent"; food: Food & { loggedCount?: number; lastLoggedDate?: string } }
  | { type: "custom"; food: Food }
  | { type: "recipe"; food: Recipe };

type CalculatorInputs = {
  age: string;
  sex: Sex;
  height: string;
  heightFeet?: string;
  heightInches?: string;
  heightUnit: HeightUnit;
  weight: string;
  weightUnit: WeightUnit;
  activityLevel: ActivityLevel;
  goal: GoalType;
  rate: GoalRate;
};

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  calculatorInputs?: CalculatorInputs;
};

type GoalsForm = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

type CustomFoodForm = {
  name: string;
  brand: string;
  servingSize: string;
  servingUnit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sodium: string;
  notes: string;
};

type RecipeForm = {
  name: string;
  servingSize: string;
  servingUnit: string;
  notes: string;
};

const mealCategories = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;

const emptyCustomFoodForm: CustomFoodForm = {
  name: "",
  brand: "",
  servingSize: "",
  servingUnit: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  fiber: "",
  sodium: "",
  notes: "",
};

const emptyRecipeForm: RecipeForm = {
  name: "",
  servingSize: "",
  servingUnit: "",
  notes: "",
};

const defaultCalculatorInputs: CalculatorInputs = {
  age: "",
  sex: "female",
  height: "",
  heightFeet: "",
  heightInches: "",
  heightUnit: "ftIn",
  weight: "",
  weightUnit: "lb",
  activityLevel: "moderate",
  goal: "maintain",
  rate: "moderate",
};

const activityMultipliers: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

const activityLabels: Record<ActivityLevel, string> = {
  sedentary: "Sedentary",
  light: "Light",
  moderate: "Moderate",
  active: "Active",
  veryActive: "Very active",
};

const goalLabels: Record<GoalType, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

const rateLabels: Record<GoalRate, string> = {
  mild: "Mild",
  moderate: "Moderate",
  aggressive: "Aggressive",
};

const activityOptions = Object.keys(activityLabels) as ActivityLevel[];
const goalOptions = Object.keys(goalLabels) as GoalType[];

const brandSynonyms: Record<string, string[]> = {
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

type MealCategory = (typeof mealCategories)[number];

type LogItem = Food & { logId: string; category: MealCategory; quantity: number };

type SavedLogItem = Food & { logId: string; category?: MealCategory; quantity?: number };

function getSavedLog(date: string) {
  const saved = localStorage.getItem(`log-${date}`);
  if (!saved) return [];

  return (JSON.parse(saved) as SavedLogItem[]).map((item) => ({
    ...item,
    category: item.category ?? "Snacks",
    quantity: item.quantity ?? 1,
  }));
}

function getSavedCustomFoods() {
  const saved = localStorage.getItem("customFoods");
  if (!saved) return [];

  return JSON.parse(saved) as Food[];
}

function saveCustomFoods(foods: Food[]) {
  localStorage.setItem("customFoods", JSON.stringify(foods));
}

function getSavedRecipes() {
  const saved = localStorage.getItem("recipes");
  if (!saved) return [];

  return JSON.parse(saved) as Recipe[];
}

function getSavedGoals(): Goals | null {
  const saved = localStorage.getItem("goals");
  if (!saved) return null;
  return JSON.parse(saved) as Goals;
}

function goalsToForm(goals: Goals | null): GoalsForm {
  if (!goals) return { calories: "", protein: "", carbs: "", fat: "" };
  return {
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
  };
}

function calculatorInputsToForm(goals: Goals | null): CalculatorInputs {
  const inputs = goals?.calculatorInputs;
  if (!inputs) return defaultCalculatorInputs;

  if (inputs.heightUnit === "in") {
    const totalInches = Number(inputs.height);

    if (Number.isFinite(totalInches) && totalInches > 0) {
      return {
        ...inputs,
        heightFeet: String(Math.floor(totalInches / 12)),
        heightInches: String(Number((totalInches % 12).toFixed(1))),
        heightUnit: "ftIn",
      };
    }

    return {
      ...inputs,
      heightUnit: "ftIn",
    };
  }

  return inputs;
}

function saveRecipes(recipes: Recipe[]) {
  localStorage.setItem("recipes", JSON.stringify(recipes));
}

function shiftDate(date: string, dayOffset: number) {
  const [year, month, day] = date.split("-").map(Number);
  const nextDate = new Date(year, month - 1, day + dayOffset);
  const nextYear = nextDate.getFullYear();
  const nextMonth = String(nextDate.getMonth() + 1).padStart(2, "0");
  const nextDay = String(nextDate.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateRangeEnding(date: string, days: number) {
  return Array.from({ length: days }, (_, index) => shiftDate(date, -index));
}

function cleanPortionText(text: string | null | undefined) {
  const cleaned = text?.trim();
  if (!cleaned) return "";

  if (cleaned.toLowerCase() === "undetermined") return "";
  if (/^[\d\s.,-]+$/.test(cleaned)) return "";

  return cleaned;
}

function formatPortionAmount(amount: number | null | undefined) {
  if (!amount || !Number.isFinite(amount)) return "";

  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)));
}

function formatGramWeight(gramWeight: number) {
  return Number.isInteger(gramWeight) ? `${gramWeight}g` : `${Number(gramWeight.toFixed(1))}g`;
}

function getLocalPortionUnit(food: Food) {
  return parseServingSize(food.servingSize)?.unit === "ml" ? "ml" : "g";
}

function formatLocalPortionAmount(food: Food, amount: number) {
  const value = Number.isInteger(amount) ? amount : Number(amount.toFixed(1));
  return `${value}${getLocalPortionUnit(food)}`;
}

function getPortionLabel(portion: FoodPortion, foodName: string) {
  const amount = formatPortionAmount(portion.amount);
  const modifier = cleanPortionText(portion.modifier);
  const measure = cleanPortionText(portion.measureUnit?.abbreviation || portion.measureUnit?.name);
  const gramWeight = portion.gramWeight ?? 0;

  if (modifier) {
    const label = [amount || "1", modifier, foodName].join(" ");
    return `${label} (${formatGramWeight(gramWeight)})`;
  }

  if (amount && measure) {
    return `${amount} ${measure}`;
  }

  if (measure) {
    return measure;
  }

  return formatGramWeight(gramWeight);
}

function getPortionOptions(detail: FoodDetail | null, foodName = ""): PortionOption[] {
  return (
    detail?.foodPortions
      ?.map((portion, index) => ({
        value: String(portion.id ?? index),
        label: getPortionLabel(portion, foodName),
        gramWeight: portion.gramWeight ?? 0,
      }))
      .filter((portion) => portion.gramWeight > 0) ?? []
  );
}

function getEnergyCaloriesPer100Units(detail: FoodDetail | null) {
  const energy = detail?.foodNutrients?.find((nutrient) => {
    const name = nutrient.nutrient?.name ?? nutrient.nutrientName ?? "";
    const unit = nutrient.nutrient?.unitName ?? nutrient.unitName ?? "";

    return name.toLowerCase() === "energy" && unit.toLowerCase() === "kcal";
  });

  const amount = energy?.amount ?? energy?.value;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

function getLabelCaloriesPerServing(detail: FoodDetail | null) {
  const calories = detail?.labelNutrients?.calories?.value;

  return typeof calories === "number" && Number.isFinite(calories) && calories > 0
    ? Math.round(calories)
    : null;
}

function parseServingSize(value: string | number | null | undefined, fallbackUnit = "") {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      amount: value,
      unit: fallbackUnit.trim().toLowerCase(),
    };
  }

  if (typeof value !== "string") return null;

  const match = value.trim().match(/^([\d.]+)\s*([a-zA-Z]*)/);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    amount,
    unit: (fallbackUnit || match[2]).trim().toLowerCase(),
  };
}

function isGramUnit(unit: string) {
  return unit === "g" || unit === "gram" || unit === "grams" || unit === "ml";
}

function getScaleFromServingBasis(food: Food, amount: number) {
  const basis = parseServingSize(food.servingSize);
  if (!basis || !isGramUnit(basis.unit)) return null;

  return amount / basis.amount;
}

function getServingSizeBasis(detail: FoodDetail | null, food: Food) {
  return (
    parseServingSize(detail?.servingSize, detail?.servingSizeUnit ?? "") ??
    parseServingSize(food.servingSize)
  );
}

function isBrandedFood(food: Food) {
  return food.dataType?.toLowerCase() === "branded" || Boolean(food.brand);
}

function hasUsableSearchNutrition(food: Food) {
  const basis = parseServingSize(food.servingSize);
  return !isBrandedFood(food) && Boolean(basis && isGramUnit(basis.unit) && food.calories > 0);
}

function getServingSizeLabel(detail: FoodDetail | null, food: Food) {
  const basis = getServingSizeBasis(detail, food);
  return basis ? `${basis.amount} ${basis.unit}`.trim() : food.servingSize;
}

function scaleFoodNutrition(food: Food, factor: number, servingSize: string): Food {
  return {
    ...food,
    servingSize,
    calories: Math.round(food.calories * factor),
    protein: food.protein * factor,
    carbs: food.carbs * factor,
    fat: food.fat * factor,
    fiber: food.fiber === undefined ? undefined : food.fiber * factor,
    sodium: food.sodium === undefined ? undefined : food.sodium * factor,
  };
}

function foodFromDetailNutrition(food: Food, detail: FoodDetail, servingSize: string): Food {
  return {
    ...food,
    servingSize,
    calories: Math.round(detail.nutrients?.calories ?? food.calories),
    protein: detail.nutrients?.protein ?? food.protein,
    carbs: detail.nutrients?.carbs ?? food.carbs,
    fat: detail.nutrients?.fat ?? food.fat,
    fiber: detail.nutrients?.fiber ?? food.fiber,
    sodium: detail.nutrients?.sodium ?? food.sodium,
  };
}

function getFoodForSelectedPortion(
  food: Food,
  detail: FoodDetail | null,
  portion: PortionOption | undefined,
  amount: number
): Food {
  const localScale =
    hasUsableSearchNutrition(food) && Number.isFinite(amount) && amount > 0
      ? getScaleFromServingBasis(food, amount)
      : null;

  if (localScale !== null) {
    return scaleFoodNutrition(food, localScale, formatLocalPortionAmount(food, amount));
  }

  if (portion && detail) {
    const servingSize = `${portion.label} (${portion.gramWeight}g)`;
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

  if (detail) {
    const servingSize = getServingSizeLabel(detail, food);

    return {
      ...foodFromDetailNutrition(food, detail, servingSize),
      calories: getCaloriesPerServing(food, detail),
    };
  }

  return food;
}

function getCaloriesPerServing(food: Food, detail: FoodDetail | null, portion?: PortionOption) {
  const caloriesPer100Units = getEnergyCaloriesPer100Units(detail);

  if (portion && caloriesPer100Units !== null) {
    return Math.round((caloriesPer100Units * portion.gramWeight) / 100);
  }

  const labelCalories = getLabelCaloriesPerServing(detail);
  if (labelCalories !== null) return labelCalories;

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

function getModalResultCalories(
  food: Food,
  selectedFood: Food | null,
  selectedFoodDetail: FoodDetail | null,
  selectedPortion: PortionOption | undefined,
  isLoadingDetail: boolean
) {
  if (selectedFood?.id !== food.id) {
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
        ? `${selectedPortion.label} (${selectedPortion.gramWeight}g)`
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

function getRecentFoods(selectedDate: string) {
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

function matchesFoodQuery(food: Food, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return `${food.name} ${food.brand ?? ""}`.toLowerCase().includes(normalizedQuery);
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getSearchTokens(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function getSearchSynonyms(query: string) {
  const queryText = normalizeSearchText(query);
  const compactQuery = queryText.replace(/\s+/g, "");
  const directSynonyms = brandSynonyms[queryText];
  const compactSynonyms = Object.entries(brandSynonyms).find(
    ([key]) => normalizeSearchText(key).replace(/\s+/g, "") === compactQuery
  )?.[1];

  return [...new Set((directSynonyms ?? compactSynonyms ?? []).map(normalizeSearchText))];
}

function getFoodSearchScore(food: Food, query: string) {
  const queryText = normalizeSearchText(query);
  const queryWords = getSearchTokens(query);
  if (!queryText || queryWords.length === 0) return 0;

  const nameText = normalizeSearchText(food.name);
  const brandText = normalizeSearchText(food.brand ?? "");
  const compactName = nameText.replace(/\s+/g, "");
  const compactQuery = queryText.replace(/\s+/g, "");
  const matchedNameWords = queryWords.filter((word) => nameText.includes(word));
  const synonymMatches = getSearchSynonyms(query).filter(
    (synonym) => nameText.includes(synonym) || brandText.includes(synonym)
  );
  let score = 0;

  if (nameText.includes(queryText) || compactName.includes(compactQuery)) score += 100;
  if (synonymMatches.length > 0) score += 95 + synonymMatches.length * 8;
  if (matchedNameWords.length === queryWords.length) score += 70;
  if (nameText.startsWith(queryText)) score += 50;
  if (brandText.includes(queryText) || queryWords.some((word) => brandText.includes(word))) score += 35;
  score += matchedNameWords.length * 12;

  if (queryWords.length > 1 && matchedNameWords.length === 1) score -= 45;
  if (matchedNameWords.length === 0 && !brandText.includes(queryText)) score -= 60;

  return score;
}

function rankSearchResults(foods: Food[], query: string) {
  return [...foods].sort((a, b) => getFoodSearchScore(b, query) - getFoodSearchScore(a, query));
}

async function fetchUsdaFoods(query: string) {
  const res = await fetch(
    `https://jessica-worker.snack-bunker.workers.dev/?query=${encodeURIComponent(query)}`
  );

  return (await res.json()) as Food[];
}

async function searchUsdaFoodsWithSynonyms(query: string) {
  const searchQueries = [...new Set([query, ...getSearchSynonyms(query)])];
  const resultSets = await Promise.all(searchQueries.map(fetchUsdaFoods));
  const foodsById = new Map<number, Food>();

  for (const foods of resultSets) {
    for (const food of foods) {
      if (!foodsById.has(food.id)) foodsById.set(food.id, food);
    }
  }

  return rankSearchResults([...foodsById.values()], query);
}

function getIngredientCalories(ingredient: RecipeIngredient) {
  return Math.round(ingredient.food.calories * ingredient.quantity);
}

function getIngredientMacro(ingredient: RecipeIngredient, key: "protein" | "carbs" | "fat" | "fiber" | "sodium") {
  return (ingredient.food[key] ?? 0) * ingredient.quantity;
}

function getRecipeTotals(ingredients: RecipeIngredient[]) {
  return ingredients.reduce(
    (totals, ingredient) => ({
      calories: totals.calories + getIngredientCalories(ingredient),
      protein: totals.protein + getIngredientMacro(ingredient, "protein"),
      carbs: totals.carbs + getIngredientMacro(ingredient, "carbs"),
      fat: totals.fat + getIngredientMacro(ingredient, "fat"),
      fiber: totals.fiber + getIngredientMacro(ingredient, "fiber"),
      sodium: totals.sodium + getIngredientMacro(ingredient, "sodium"),
    }),
    {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sodium: 0,
    }
  );
}

function parseRecipe(form: RecipeForm, ingredients: RecipeIngredient[]): Recipe | null {
  const name = form.name.trim();
  const servingSize = form.servingSize.trim();
  const servingUnit = form.servingUnit.trim();

  if (!name || !servingSize || !servingUnit || ingredients.length === 0) return null;

  const totals = getRecipeTotals(ingredients);

  return {
    id: -Date.now(),
    name,
    brand: "Recipe",
    servingSize: `${servingSize} ${servingUnit}`,
    calories: Math.round(totals.calories),
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    fiber: totals.fiber,
    sodium: totals.sodium,
    notes: form.notes.trim() || undefined,
    ingredients,
  };
}

function foodToCustomFoodForm(food: Food): CustomFoodForm {
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
    sodium: String(food.sodium ?? 0),
    notes: food.notes ?? "",
  };
}

function recipeToRecipeForm(recipe: Recipe): RecipeForm {
  const serving = parseServingSize(recipe.servingSize);

  return {
    name: recipe.name,
    servingSize: serving ? String(serving.amount) : recipe.servingSize,
    servingUnit: serving?.unit ?? "",
    notes: recipe.notes ?? "",
  };
}

function parseCustomFood(form: CustomFoodForm): Food | null {
  const name = form.name.trim();
  const servingSize = form.servingSize.trim();
  const servingUnit = form.servingUnit.trim();
  const calories = Number(form.calories);
  const protein = Number(form.protein || 0);
  const carbs = Number(form.carbs || 0);
  const fat = Number(form.fat || 0);
  const fiber = Number(form.fiber || 0);
  const sodium = Number(form.sodium || 0);

  if (!name || !servingSize || !servingUnit || !Number.isFinite(calories) || calories < 0) {
    return null;
  }

  if (![protein, carbs, fat, fiber, sodium].every((value) => Number.isFinite(value) && value >= 0)) {
    return null;
  }

  return {
    id: -Date.now(),
    name,
    brand: form.brand.trim() || null,
    servingSize: `${servingSize} ${servingUnit}`,
    calories: Math.round(calories),
    protein,
    carbs,
    fat,
    fiber,
    sodium,
    notes: form.notes.trim() || undefined,
  };
}

function formatMacro(value: number) {
  return Number(value.toFixed(1));
}

function getValidRates(goal: GoalType): GoalRate[] {
  if (goal === "maintain") return ["moderate"];
  if (goal === "gain") return ["mild", "moderate"];
  return ["mild", "moderate", "aggressive"];
}

function getGoalAdjustment(goal: GoalType, rate: GoalRate) {
  if (goal === "maintain") return 0;
  if (goal === "lose") {
    return {
      mild: -250,
      moderate: -500,
      aggressive: -750,
    }[rate];
  }

  return {
    mild: 250,
    moderate: 500,
    aggressive: 500,
  }[rate];
}

function getMacroGoals(goalCalories: number) {
  return {
    calories: Math.round(goalCalories),
    protein: Math.round((goalCalories * 0.3) / 4),
    carbs: Math.round((goalCalories * 0.4) / 4),
    fat: Math.round((goalCalories * 0.3) / 9),
  };
}

function getHeightCm(inputs: CalculatorInputs) {
  if (inputs.heightUnit === "cm") {
    const height = Number(inputs.height);
    return Number.isFinite(height) && height > 0 ? height : null;
  }

  if (inputs.heightUnit === "in") {
    const height = Number(inputs.height);
    return Number.isFinite(height) && height > 0 ? height * 2.54 : null;
  }

  const feet = Number(inputs.heightFeet || 0);
  const inches = Number(inputs.heightInches || 0);

  if (!Number.isFinite(feet) || !Number.isFinite(inches) || feet < 0 || inches < 0) return null;

  const totalInches = feet * 12 + inches;
  return totalInches > 0 ? totalInches * 2.54 : null;
}

function calculateGoalsFromInputs(inputs: CalculatorInputs): Goals | null {
  const age = Number(inputs.age);
  const weight = Number(inputs.weight);
  const heightCm = getHeightCm(inputs);

  if (
    !Number.isFinite(age) ||
    age < 18 ||
    age > 120 ||
    !Number.isFinite(weight) ||
    weight <= 0 ||
    heightCm === null
  ) {
    return null;
  }

  const weightKg = inputs.weightUnit === "kg" ? weight : weight * 0.45359237;
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (inputs.sex === "female" ? -161 : 5);
  const tdee = bmr * activityMultipliers[inputs.activityLevel];
  const calorieGoal = tdee + getGoalAdjustment(inputs.goal, inputs.rate);

  return {
    ...getMacroGoals(calorieGoal),
    calculatorInputs: inputs,
  };
}

function getAgeValidationMessage(ageInput: string) {
  const age = Number(ageInput);

  if (!Number.isFinite(age) || ageInput === "") return "";
  if (age < 18) return "Calculator is for adults only.";
  if (age > 120) return "Please enter a valid age.";

  return "";
}

function getWeekDates(referenceDate: string) {
  const [year, month, day] = referenceDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => shiftDate(referenceDate, daysToMonday + i));
}

function getDayLabel(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" });
}

function formatWeekRange(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function App() {
  const today = getLocalDateString();
  const [appView, setAppView] = useState<AppView>("home");
  const [selectedDate, setSelectedDate] = useState(today);
  const [log, setLog] = useState<LogItem[]>(() => getSavedLog(today));
  const [pendingCategory, setPendingCategory] = useState<MealCategory | null>(null);
  const [activeAddFoodTab, setActiveAddFoodTab] = useState<AddFoodTab>("search");
  const [modalQuery, setModalQuery] = useState("");
  const [modalFoods, setModalFoods] = useState<Food[]>([]);
  const [customFoods, setCustomFoods] = useState<Food[]>(() => getSavedCustomFoods());
  const [customQuery, setCustomQuery] = useState("");
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [customFoodForm, setCustomFoodForm] = useState<CustomFoodForm>(emptyCustomFoodForm);
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
  const [goals, setGoals] = useState<Goals | null>(() => getSavedGoals());
  const [goalsForm, setGoalsForm] = useState<GoalsForm>(() => goalsToForm(getSavedGoals()));
  const [calculatorInputs, setCalculatorInputs] = useState<CalculatorInputs>(() =>
    calculatorInputsToForm(getSavedGoals())
  );
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(() => !getSavedGoals());
  const [isManualGoalsOpen, setIsManualGoalsOpen] = useState(false);
  const [editingCustomFoodId, setEditingCustomFoodId] = useState<number | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [libraryCustomFoodForm, setLibraryCustomFoodForm] =
    useState<CustomFoodForm>(emptyCustomFoodForm);
  const [libraryRecipeForm, setLibraryRecipeForm] = useState<RecipeForm>(emptyRecipeForm);
  const [libraryRecipeIngredients, setLibraryRecipeIngredients] = useState<RecipeIngredient[]>([]);

  useEffect(() => {
    localStorage.setItem(`log-${selectedDate}`, JSON.stringify(log));
  }, [log, selectedDate]);

  useEffect(() => {
    saveCustomFoods(customFoods);
  }, [customFoods]);

  useEffect(() => {
    saveRecipes(recipes);
  }, [recipes]);

  function changeSelectedDate(date: string) {
    setSelectedDate(date);
    setLog(getSavedLog(date));
  }

  function moveSelectedDate(dayOffset: number) {
    changeSelectedDate(shiftDate(selectedDate, dayOffset));
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

  function getCategoryCalories(category: MealCategory) {
    return log
      .filter((item) => item.category === category)
      .reduce((sum, item) => sum + getItemCalories(item), 0);
  }

  function openAddFood(category: MealCategory) {
    setPendingCategory(category);
    setActiveAddFoodTab("search");
    setModalQuery("");
    setModalFoods([]);
    setCustomQuery("");
    setIsCustomFormOpen(false);
    setCustomFoodForm(emptyCustomFoodForm);
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
    setIsRecipeFormOpen(false);
  }

  async function searchModalFood() {
    if (!modalQuery.trim()) return;

    setModalFoods(await searchUsdaFoodsWithSynonyms(modalQuery));
  }

  async function selectFood(food: Food) {
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(parseServingSize(food.servingSize)?.amount ?? 100));
    setDetailError("");

    if (hasUsableSearchNutrition(food)) {
      setIsLoadingDetail(false);
      return;
    }

    try {
      setIsLoadingDetail(true);
      const res = await fetch(
        `https://jessica-worker.snack-bunker.workers.dev/detail?id=${encodeURIComponent(food.id)}`
      );
      const detail = (await res.json()) as FoodDetail;
      const portions = getPortionOptions(detail, food.name);

      setSelectedFoodDetail(detail);
      setSelectedPortionValue(portions[0]?.value ?? "");
    } catch {
      setDetailError("Could not load portion details for this food.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function selectLocalFood(food: Food) {
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(parseServingSize(food.servingSize)?.amount ?? 100));
    setDetailError("");
    setIsLoadingDetail(false);
  }

  function openCustomFoodForm() {
    setSelectedFood(null);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount("100");
    setDetailError("");
    setQuantity("1");
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
    const customFood = parseCustomFood(customFoodForm);
    if (!customFood) return;

    setCustomFoods([customFood, ...customFoods]);
    setCustomFoodForm(emptyCustomFoodForm);
    setIsCustomFormOpen(false);
    setActiveAddFoodTab("custom");
    selectLocalFood(customFood);
  }

  function selectRecipeIngredient(food: Food) {
    setPendingRecipeIngredient(food);
    setPendingRecipeIngredientQuantity("1");
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

    const servings = hasUsableSearchNutrition(selectedFood) ? 1 : Number(quantity);
    if (!Number.isFinite(servings) || servings <= 0) return;

    const portionOptions = getPortionOptions(selectedFoodDetail, selectedFood.name);
    const selectedPortion = portionOptions.find((portion) => portion.value === selectedPortionValue);
    const selectedFoodServing = getFoodForSelectedPortion(
      selectedFood,
      selectedFoodDetail,
      selectedPortion,
      Number(portionAmount)
    );

    setLog([
      ...log,
      {
        ...selectedFoodServing,
        category: pendingCategory,
        quantity: servings,
        logId: crypto.randomUUID(),
      },
    ]);
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

  function openFoodLibrary() {
    setAppView("library");
    setFoodLibraryTab("recent");
    setLibraryQuery("");
    setLibrarySelection(null);
    cancelLibraryEditing();
  }

  function submitGoals() {
    const calories = Number(goalsForm.calories);
    const protein = Number(goalsForm.protein);
    const carbs = Number(goalsForm.carbs);
    const fat = Number(goalsForm.fat);

    if (!Number.isFinite(calories) || calories <= 0) return;
    if (![protein, carbs, fat].every((v) => Number.isFinite(v) && v >= 0)) return;

    const newGoals = { calories: Math.round(calories), protein, carbs, fat, calculatorInputs };
    setGoals(newGoals);
    localStorage.setItem("goals", JSON.stringify(newGoals));
    setIsManualGoalsOpen(false);
  }

  function updateCalculatorInputs(updates: Partial<CalculatorInputs>) {
    setCalculatorInputs((currentInputs) => {
      const nextInputs = { ...currentInputs, ...updates };
      const validRates = getValidRates(nextInputs.goal);

      if (!validRates.includes(nextInputs.rate)) {
        nextInputs.rate = validRates[0];
      }

      return nextInputs;
    });
  }

  function applyCalculatedGoals() {
    const newGoals = calculateGoalsFromInputs(calculatorInputs);
    if (!newGoals) return;

    setGoals(newGoals);
    setGoalsForm(goalsToForm(newGoals));
    localStorage.setItem("goals", JSON.stringify(newGoals));
    setIsCalculatorOpen(false);
    setIsManualGoalsOpen(false);
  }

  function cancelLibraryEditing() {
    setEditingCustomFoodId(null);
    setEditingRecipeId(null);
    setLibraryCustomFoodForm(emptyCustomFoodForm);
    setLibraryRecipeForm(emptyRecipeForm);
    setLibraryRecipeIngredients([]);
  }

  function editCustomFood(food: Food) {
    setEditingCustomFoodId(food.id);
    setEditingRecipeId(null);
    setLibraryCustomFoodForm(foodToCustomFoodForm(food));
    setLibrarySelection({ type: "custom", food });
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
    setLibraryRecipeForm(recipeToRecipeForm(recipe));
    setLibraryRecipeIngredients(recipe.ingredients);
    setLibrarySelection({ type: "recipe", food: recipe });
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

  const portionOptions = getPortionOptions(selectedFoodDetail, selectedFood?.name);
  const selectedPortion = portionOptions.find((portion) => portion.value === selectedPortionValue);
  const localPortionAmount = Number(portionAmount);
  const localPortionScale =
    selectedFood &&
    hasUsableSearchNutrition(selectedFood) &&
    Number.isFinite(localPortionAmount) &&
    localPortionAmount > 0
      ? getScaleFromServingBasis(selectedFood, localPortionAmount)
      : null;
  const usesLocalPortion = Boolean(selectedFood && hasUsableSearchNutrition(selectedFood));
  const selectedPortionCalories = selectedFood
    ? usesLocalPortion && localPortionScale === null
      ? null
      : localPortionScale !== null
      ? Math.round(selectedFood.calories * localPortionScale)
      : getCaloriesPerServing(selectedFood, selectedFoodDetail, selectedPortion)
    : null;
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
  const canAddSelectedFood =
    Boolean(selectedFood) &&
    !isLoadingDetail &&
    (!usesLocalPortion || localPortionScale !== null) &&
    (portionOptions.length === 0 || Boolean(selectedPortion));
  const calculatedGoals = calculateGoalsFromInputs(calculatorInputs);
  const calculatorRates = getValidRates(calculatorInputs.goal);
  const ageValidationMessage = getAgeValidationMessage(calculatorInputs.age);

  const bottomNav = (
    <nav className="bottom-nav" aria-label="Main navigation">
      <button
        type="button"
        className={appView === "home" ? "active" : ""}
        onClick={() => { setLibrarySelection(null); cancelLibraryEditing(); setAppView("home"); }}
      >
        <span className="nav-icon">⌂</span>
        <span>Home</span>
      </button>
      <button
        type="button"
        className={appView === "day" ? "active" : ""}
        onClick={() => { setLibrarySelection(null); cancelLibraryEditing(); setAppView("day"); }}
      >
        <span className="nav-icon">≡</span>
        <span>Log</span>
      </button>
      <button
        type="button"
        className={appView === "library" ? "active" : ""}
        onClick={openFoodLibrary}
      >
        <span className="nav-icon">⊞</span>
        <span>Library</span>
      </button>
      <button
        type="button"
        className={appView === "profile" ? "active" : ""}
        onClick={() => { setLibrarySelection(null); cancelLibraryEditing(); setAppView("profile"); }}
      >
        <span className="nav-icon">◉</span>
        <span>Profile</span>
      </button>
    </nav>
  );

  if (appView === "home") {
    const weekDates = getWeekDates(today);
    const weekStats = weekDates.map((date) => {
      const dayLog = getSavedLog(date);
      return {
        date,
        calories: dayLog.reduce((s, item) => s + Math.round(item.calories * (item.quantity ?? 1)), 0),
        protein: dayLog.reduce((s, item) => s + item.protein * (item.quantity ?? 1), 0),
        carbs: dayLog.reduce((s, item) => s + item.carbs * (item.quantity ?? 1), 0),
        fat: dayLog.reduce((s, item) => s + item.fat * (item.quantity ?? 1), 0),
      };
    });

    const loggedDayCount = weekStats.filter((d) => d.calories > 0).length;
    const weekTotals = weekStats.reduce(
      (totals, d) => ({
        calories: totals.calories + d.calories,
        protein: totals.protein + d.protein,
        carbs: totals.carbs + d.carbs,
        fat: totals.fat + d.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const weekAvg = {
      calories: loggedDayCount > 0 ? Math.round(weekTotals.calories / loggedDayCount) : 0,
      protein: loggedDayCount > 0 ? weekTotals.protein / loggedDayCount : 0,
      carbs: loggedDayCount > 0 ? weekTotals.carbs / loggedDayCount : 0,
      fat: loggedDayCount > 0 ? weekTotals.fat / loggedDayCount : 0,
    };
    const maxDayCalories = Math.max(...weekStats.map((d) => d.calories), 1);

    return (
      <main className="app">
        <div className="top-bar">
          <h1>Jessica App</h1>
        </div>

        <section className="panel">
          <h2>This Week</h2>
          <p className="week-range">{formatWeekRange(weekDates[0], weekDates[6])}</p>

          <div className="week-summary">
            {[
              { label: "Avg Cal / day", value: weekAvg.calories, goal: goals?.calories ?? null, unit: "", isInt: true },
              { label: "Avg Protein", value: weekAvg.protein, goal: goals?.protein ?? null, unit: "g", isInt: false },
              { label: "Avg Carbs", value: weekAvg.carbs, goal: goals?.carbs ?? null, unit: "g", isInt: false },
              { label: "Avg Fat", value: weekAvg.fat, goal: goals?.fat ?? null, unit: "g", isInt: false },
            ].map(({ label, value, goal, unit, isInt }) => (
              <div className="summary-card" key={label}>
                <span>{label}</span>
                <strong>
                  {isInt ? value : formatMacro(value)}{unit}
                  {goal ? ` / ${goal}${unit}` : ""}
                </strong>
                {goal && goal > 0 && (
                  <div className="macro-bar-track">
                    <div
                      className={`macro-bar-fill${value > goal ? " over" : ""}`}
                      style={{ width: `${Math.min(100, Math.round((value / goal) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="week-bars" aria-label="Calories per day this week">
            {weekStats.map(({ date, calories }) => {
              const isToday = date === today;
              const barHeight =
                calories > 0 ? Math.max(Math.round((calories / maxDayCalories) * 120), 6) : 3;
              return (
                <button
                  key={date}
                  type="button"
                  className="week-bar-col"
                  onClick={() => { changeSelectedDate(date); setAppView("day"); }}
                  title={calories > 0 ? `${calories} cal` : "No data"}
                >
                  {calories > 0 && <span className="week-bar-val">{calories}</span>}
                  <div
                    className={`week-bar${isToday ? " is-today" : ""}`}
                    style={{ height: barHeight }}
                  />
                  <span className={`week-bar-day${isToday ? " is-today" : ""}`}>
                    {getDayLabel(date)}
                  </span>
                </button>
              );
            })}
          </div>

          {loggedDayCount === 0 && (
            <p className="empty-meal">No food logged this week. Head to Log to get started.</p>
          )}
        </section>

        {bottomNav}
      </main>
    );
  }

  if (appView === "profile") {
    return (
      <main className="app">
        <div className="top-bar">
          <h1>Profile</h1>
        </div>

        <section className="panel targets-card">
          <div className="section-heading-row">
            <div>
              <h2>Your Targets</h2>
              <p className="week-range">Daily nutrition goals used by Home and Log.</p>
            </div>
          </div>

          {goals ? (
            <div className="targets-grid">
              <div>
                <span>Calories</span>
                <strong>{goals.calories}/day</strong>
              </div>
              <div>
                <span>Protein</span>
                <strong>{goals.protein}g</strong>
              </div>
              <div>
                <span>Carbs</span>
                <strong>{goals.carbs}g</strong>
              </div>
              <div>
                <span>Fat</span>
                <strong>{goals.fat}g</strong>
              </div>
            </div>
          ) : (
            <p className="empty-meal">No saved targets yet.</p>
          )}

          <div className="profile-actions">
            <button type="button" onClick={() => setIsCalculatorOpen(true)}>
              Recalculate
            </button>
            <button type="button" onClick={() => setIsManualGoalsOpen((isOpen) => !isOpen)}>
              Edit manually
            </button>
          </div>
        </section>

        <section className="panel">
          <button
            type="button"
            className="section-toggle"
            onClick={() => setIsCalculatorOpen((isOpen) => !isOpen)}
            aria-expanded={isCalculatorOpen}
          >
            <span>
              <strong>Calorie & Macro Calculator</strong>
              <small>Estimate your daily targets from your stats and goal.</small>
            </span>
            <span>{isCalculatorOpen ? "Hide" : "Open"}</span>
          </button>

          {isCalculatorOpen && (
            <div className="calculator-form">
              <fieldset className="calculator-group">
                <legend>About You</legend>

                <div className="calculator-fields">
                  <label>
                    Age
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={calculatorInputs.age}
                      onChange={(e) => updateCalculatorInputs({ age: e.target.value })}
                    />
                  </label>

                  <label>
                    Sex
                    <select
                      value={calculatorInputs.sex}
                      onChange={(e) => updateCalculatorInputs({ sex: e.target.value as Sex })}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>

                  <label>
                    Height
                    <div
                      className={
                        calculatorInputs.heightUnit === "ftIn"
                          ? "height-input-row"
                          : "compound-input-row"
                      }
                    >
                      {calculatorInputs.heightUnit === "ftIn" ? (
                        <>
                          <input
                            aria-label="Height feet"
                            type="number"
                            min="0"
                            step="1"
                            placeholder="ft"
                            value={calculatorInputs.heightFeet ?? ""}
                            onChange={(e) =>
                              updateCalculatorInputs({ heightFeet: e.target.value })
                            }
                          />
                          <input
                            aria-label="Height inches"
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="in"
                            value={calculatorInputs.heightInches ?? ""}
                            onChange={(e) =>
                              updateCalculatorInputs({ heightInches: e.target.value })
                            }
                          />
                        </>
                      ) : (
                        <input
                          type="number"
                          min="1"
                          step="0.1"
                          value={calculatorInputs.height}
                          onChange={(e) => updateCalculatorInputs({ height: e.target.value })}
                        />
                      )}
                      <select
                        value={calculatorInputs.heightUnit}
                        onChange={(e) =>
                          updateCalculatorInputs({ heightUnit: e.target.value as HeightUnit })
                        }
                      >
                        <option value="ftIn">ft/in</option>
                        <option value="in">in only</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                  </label>

                  <label>
                    Weight
                    <div className="compound-input-row">
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={calculatorInputs.weight}
                        onChange={(e) => updateCalculatorInputs({ weight: e.target.value })}
                      />
                      <select
                        value={calculatorInputs.weightUnit}
                        onChange={(e) =>
                          updateCalculatorInputs({ weightUnit: e.target.value as WeightUnit })
                        }
                      >
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                  </label>
                </div>

                {ageValidationMessage && <p className="profile-warning">{ageValidationMessage}</p>}
              </fieldset>

              <fieldset className="calculator-group">
                <legend>Activity</legend>
                <div className="option-card-grid">
                  {activityOptions.map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`option-card${
                        calculatorInputs.activityLevel === level ? " selected" : ""
                      }`}
                      onClick={() => updateCalculatorInputs({ activityLevel: level })}
                    >
                      {activityLabels[level]}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="calculator-group">
                <legend>Goal</legend>
                <div className="option-card-grid three">
                  {goalOptions.map((goal) => (
                    <button
                      key={goal}
                      type="button"
                      className={`option-card${calculatorInputs.goal === goal ? " selected" : ""}`}
                      onClick={() => updateCalculatorInputs({ goal })}
                    >
                      {goalLabels[goal]}
                    </button>
                  ))}
                </div>
              </fieldset>

              {calculatorInputs.goal !== "maintain" && (
                <fieldset className="calculator-group">
                  <legend>Pace</legend>
                  <div className="option-card-grid three">
                    {calculatorRates.map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        className={`option-card${calculatorInputs.rate === rate ? " selected" : ""}`}
                        onClick={() => updateCalculatorInputs({ rate })}
                      >
                        {rateLabels[rate]}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              <div className="calculator-estimate">
                <span>Estimated target</span>
                {calculatedGoals ? (
                  <>
                    <strong>{calculatedGoals.calories} cal/day</strong>
                    <small>
                      {calculatedGoals.protein}g P / {calculatedGoals.carbs}g C /{" "}
                      {calculatedGoals.fat}g F
                    </small>
                  </>
                ) : (
                  <strong>Enter age, height, and weight</strong>
                )}
              </div>

              <button
                type="button"
                className="primary-button"
                onClick={applyCalculatedGoals}
                disabled={!calculatedGoals}
              >
                Save Targets
              </button>
            </div>
          )}
        </section>

        {isManualGoalsOpen && (
          <section className="panel">
            <h2>Manual Targets</h2>
            <p className="week-range">Fine-tune your saved targets manually.</p>

            <div className="goals-form">
              {[
                { key: "calories" as const, label: "Calories", unit: "cal / day" },
                { key: "protein" as const, label: "Protein", unit: "g / day" },
                { key: "carbs" as const, label: "Carbs", unit: "g / day" },
                { key: "fat" as const, label: "Fat", unit: "g / day" },
              ].map(({ key, label, unit }) => (
                <label key={key}>
                  {label}
                  <div className="goals-input-row">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={goalsForm[key]}
                      onChange={(e) => setGoalsForm({ ...goalsForm, [key]: e.target.value })}
                    />
                    <span>{unit}</span>
                  </div>
                </label>
              ))}

              <button type="button" className="primary-button" onClick={submitGoals}>
                Save goals
              </button>
            </div>
          </section>
        )}

        {bottomNav}
      </main>
    );
  }

  if (appView === "library") {
    return (
      <main className="app">
        <div className="top-bar">
          <h1>Food Library</h1>
        </div>

        <section className="panel library-layout">
          <div className="library-main">
            <div className="tab-row" role="tablist" aria-label="Food library sections">
              <button
                className={foodLibraryTab === "recent" ? "active" : ""}
                type="button"
                onClick={() => {
                  setFoodLibraryTab("recent");
                  setLibrarySelection(null);
                  cancelLibraryEditing();
                }}
                role="tab"
                aria-selected={foodLibraryTab === "recent"}
              >
                Recent
              </button>
              <button
                className={foodLibraryTab === "custom" ? "active" : ""}
                type="button"
                onClick={() => {
                  setFoodLibraryTab("custom");
                  setLibrarySelection(null);
                  cancelLibraryEditing();
                }}
                role="tab"
                aria-selected={foodLibraryTab === "custom"}
              >
                Custom
              </button>
              <button
                className={foodLibraryTab === "recipes" ? "active" : ""}
                type="button"
                onClick={() => {
                  setFoodLibraryTab("recipes");
                  setLibrarySelection(null);
                  cancelLibraryEditing();
                }}
                role="tab"
                aria-selected={foodLibraryTab === "recipes"}
              >
                Recipes
              </button>
            </div>

            <input
              className="library-search"
              value={libraryQuery}
              placeholder={`Search ${foodLibraryTab}...`}
              onChange={(e) => setLibraryQuery(e.target.value)}
            />

            <div className="library-list">
              {foodLibraryTab === "recent" && libraryRecentFoods.length === 0 && (
                <p className="empty-meal">No recent foods match this search.</p>
              )}

              {foodLibraryTab === "recent" &&
                libraryRecentFoods.map((food) => (
                  <button
                    className={`food-card ${
                      librarySelection?.food.id === food.id ? "selected" : ""
                    }`}
                    key={food.id}
                    type="button"
                    onClick={() => setLibrarySelection({ type: "recent", food })}
                  >
                    <strong>{food.name}</strong>
                    <span>Brand: {food.brand || "Generic"}</span>
                    <span>
                      {food.calories} cal per {food.servingSize}
                    </span>
                    <span>Logged {food.loggedCount ?? 0} times this week</span>
                  </button>
                ))}

              {foodLibraryTab === "custom" && libraryCustomFoods.length === 0 && (
                <p className="empty-meal">No custom foods match this search.</p>
              )}

              {foodLibraryTab === "custom" &&
                libraryCustomFoods.map((food) => (
                  <button
                    className={`food-card ${
                      librarySelection?.food.id === food.id ? "selected" : ""
                    }`}
                    key={food.id}
                    type="button"
                    onClick={() => setLibrarySelection({ type: "custom", food })}
                  >
                    <strong>{food.name}</strong>
                    <span>Brand: {food.brand || "Generic"}</span>
                    <span>
                      {food.calories} cal per {food.servingSize}
                    </span>
                  </button>
                ))}

              {foodLibraryTab === "recipes" && libraryRecipes.length === 0 && (
                <p className="empty-meal">No recipes match this search.</p>
              )}

              {foodLibraryTab === "recipes" &&
                libraryRecipes.map((recipe) => (
                  <button
                    className={`food-card ${
                      librarySelection?.food.id === recipe.id ? "selected" : ""
                    }`}
                    key={recipe.id}
                    type="button"
                    onClick={() => setLibrarySelection({ type: "recipe", food: recipe })}
                  >
                    <strong>{recipe.name}</strong>
                    <span>{recipe.ingredients.length} ingredients</span>
                    <span>
                      {recipe.calories} cal per {recipe.servingSize}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <aside className="library-detail">
            {!librarySelection && <p className="empty-meal">Select a food to view details.</p>}

            {librarySelection && (
              <>
                <h2>{librarySelection.food.name}</h2>
                <p>{librarySelection.food.brand || "Generic"}</p>
                <div className="nutrition-grid">
                  <span>Serving</span>
                  <strong>{librarySelection.food.servingSize}</strong>
                  <span>Calories</span>
                  <strong>{librarySelection.food.calories}</strong>
                  <span>Protein</span>
                  <strong>{Number(librarySelection.food.protein.toFixed(1))}g</strong>
                  <span>Carbs</span>
                  <strong>{Number(librarySelection.food.carbs.toFixed(1))}g</strong>
                  <span>Fat</span>
                  <strong>{Number(librarySelection.food.fat.toFixed(1))}g</strong>
                  <span>Fiber</span>
                  <strong>{Number((librarySelection.food.fiber ?? 0).toFixed(1))}g</strong>
                  <span>Sodium</span>
                  <strong>{Number((librarySelection.food.sodium ?? 0).toFixed(1))}mg</strong>
                </div>
                {librarySelection.food.notes && <p>{librarySelection.food.notes}</p>}
              </>
            )}

            {librarySelection?.type === "recent" && (
              <p className="empty-meal">Recent foods are read-only shortcuts from your log history.</p>
            )}

            {librarySelection?.type === "custom" && editingCustomFoodId !== librarySelection.food.id && (
              <div className="form-actions">
                <button type="button" onClick={() => editCustomFood(librarySelection.food)}>
                  Edit
                </button>
                <button type="button" onClick={() => deleteCustomFood(librarySelection.food.id)}>
                  Delete
                </button>
              </div>
            )}

            {librarySelection?.type === "custom" && editingCustomFoodId === librarySelection.food.id && (
              <div className="custom-food-form library-edit-form">
                <label>
                  Name
                  <input
                    value={libraryCustomFoodForm.name}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Brand
                  <input
                    value={libraryCustomFoodForm.brand}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, brand: e.target.value })
                    }
                  />
                </label>
                <label>
                  Serving size
                  <input
                    value={libraryCustomFoodForm.servingSize}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({
                        ...libraryCustomFoodForm,
                        servingSize: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Serving unit
                  <input
                    value={libraryCustomFoodForm.servingUnit}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({
                        ...libraryCustomFoodForm,
                        servingUnit: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Calories
                  <input
                    type="number"
                    min="0"
                    value={libraryCustomFoodForm.calories}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({
                        ...libraryCustomFoodForm,
                        calories: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Protein
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={libraryCustomFoodForm.protein}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, protein: e.target.value })
                    }
                  />
                </label>
                <label>
                  Carbs
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={libraryCustomFoodForm.carbs}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, carbs: e.target.value })
                    }
                  />
                </label>
                <label>
                  Fat
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={libraryCustomFoodForm.fat}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, fat: e.target.value })
                    }
                  />
                </label>
                <label>
                  Fiber
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={libraryCustomFoodForm.fiber}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, fiber: e.target.value })
                    }
                  />
                </label>
                <label>
                  Sodium
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={libraryCustomFoodForm.sodium}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, sodium: e.target.value })
                    }
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    value={libraryCustomFoodForm.notes}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, notes: e.target.value })
                    }
                  />
                </label>
                <div className="form-actions">
                  <button type="button" onClick={saveLibraryCustomFood}>
                    Save
                  </button>
                  <button type="button" onClick={cancelLibraryEditing}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {librarySelection?.type === "recipe" && (
              <>
                <div className="ingredient-list">
                  {librarySelection.food.ingredients.map((ingredient) => (
                    <div className="ingredient-row" key={ingredient.food.id}>
                      <span>{ingredient.food.name}</span>
                      <span>x {ingredient.quantity}</span>
                      <span>{getIngredientCalories(ingredient)} cal</span>
                    </div>
                  ))}
                </div>

                {editingRecipeId !== librarySelection.food.id && (
                  <div className="form-actions">
                    <button type="button" onClick={() => editRecipe(librarySelection.food)}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteRecipe(librarySelection.food.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </>
            )}

            {librarySelection?.type === "recipe" && editingRecipeId === librarySelection.food.id && (
              <div className="recipe-builder library-edit-form">
                <div className="custom-food-form">
                  <label>
                    Recipe name
                    <input
                      value={libraryRecipeForm.name}
                      onChange={(e) =>
                        setLibraryRecipeForm({ ...libraryRecipeForm, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Serving size
                    <input
                      value={libraryRecipeForm.servingSize}
                      onChange={(e) =>
                        setLibraryRecipeForm({ ...libraryRecipeForm, servingSize: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Serving unit
                    <input
                      value={libraryRecipeForm.servingUnit}
                      onChange={(e) =>
                        setLibraryRecipeForm({ ...libraryRecipeForm, servingUnit: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Notes
                    <textarea
                      value={libraryRecipeForm.notes}
                      onChange={(e) =>
                        setLibraryRecipeForm({ ...libraryRecipeForm, notes: e.target.value })
                      }
                    />
                  </label>
                </div>

                <div className="ingredient-list">
                  {libraryRecipeIngredients.map((ingredient) => (
                    <div className="ingredient-row" key={ingredient.food.id}>
                      <span>{ingredient.food.name}</span>
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={ingredient.quantity}
                        onChange={(e) =>
                          updateLibraryRecipeIngredientQuantity(ingredient.food.id, e.target.value)
                        }
                      />
                      <span>{getIngredientCalories(ingredient)} cal</span>
                      <button
                        type="button"
                        onClick={() => removeLibraryRecipeIngredient(ingredient.food.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="form-actions">
                  <button type="button" onClick={saveLibraryRecipe}>
                    Save
                  </button>
                  <button type="button" onClick={cancelLibraryEditing}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>

        {bottomNav}
      </main>
    );
  }

  return (
    <main className="app">
      <div className="top-bar">
        <h1>Jessica App</h1>
      </div>

      <section className="panel day-summary">
        <div className="date-row">
          <button type="button" onClick={() => moveSelectedDate(-1)} aria-label="Previous day">
            &lt;
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => changeSelectedDate(e.target.value)}
          />
          <button type="button" onClick={() => moveSelectedDate(1)} aria-label="Next day">
            &gt;
          </button>
        </div>

        <h2>{selectedDate}</h2>

        <div className="daily-nutrition-summary">
          <h3>Daily Nutrition</h3>
          {[
            { label: "Calories", value: totalCalories, goal: goals?.calories ?? null, unit: "" },
            { label: "Protein", value: dailyTotals.protein, goal: goals?.protein ?? null, unit: "g" },
            { label: "Carbs", value: dailyTotals.carbs, goal: goals?.carbs ?? null, unit: "g" },
            { label: "Fat", value: dailyTotals.fat, goal: goals?.fat ?? null, unit: "g" },
          ].map(({ label, value, goal, unit }) => (
            <div key={label}>
              <span>{label}</span>
              <strong>
                {label === "Calories" ? value : formatMacro(value)}{unit}
                {goal ? ` / ${goal}${unit}` : ""}
              </strong>
              {goal && goal > 0 && (
                <div className="macro-bar-track">
                  <div
                    className={`macro-bar-fill${value > goal ? " over" : ""}`}
                    style={{ width: `${Math.min(100, Math.round((value / goal) * 100))}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="meal-groups">
          {mealCategories.map((category) => (
            <section className="meal-group" key={category}>
              <div className="meal-header">
                <h4>
                  {category}
                  <span>{getCategoryCalories(category)} cal</span>
                </h4>
                <button
                  className="add-food-button"
                  type="button"
                  onClick={() => openAddFood(category)}
                  aria-label={`Add food to ${category}`}
                >
                  +
                </button>
              </div>

              <div className="log">
                {log.filter((item) => item.category === category).length === 0 && (
                  <p className="empty-meal">No foods logged.</p>
                )}

                {log
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <div className="log-item" key={item.logId}>
                      <span>
                        {item.name} x {item.quantity} - {getItemCalories(item)} cal
                      </span>
                      <button onClick={() => setItemToRemove(item)}>Remove</button>
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      {pendingCategory && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="meal-category-title">
            <h2 id="meal-category-title">Add to {pendingCategory}</h2>

            <div className="tab-row" role="tablist" aria-label="Add food source">
              <button
                className={activeAddFoodTab === "recent" ? "active" : ""}
                type="button"
                onClick={() => setActiveAddFoodTab("recent")}
                role="tab"
                aria-selected={activeAddFoodTab === "recent"}
              >
                Recent
              </button>
              <button
                className={activeAddFoodTab === "search" ? "active" : ""}
                type="button"
                onClick={() => setActiveAddFoodTab("search")}
                role="tab"
                aria-selected={activeAddFoodTab === "search"}
              >
                Search
              </button>
              <button
                className={activeAddFoodTab === "custom" ? "active" : ""}
                type="button"
                onClick={() => setActiveAddFoodTab("custom")}
                role="tab"
                aria-selected={activeAddFoodTab === "custom"}
              >
                Custom
              </button>
              <button
                className={activeAddFoodTab === "recipes" ? "active" : ""}
                type="button"
                onClick={() => setActiveAddFoodTab("recipes")}
                role="tab"
                aria-selected={activeAddFoodTab === "recipes"}
              >
                Recipes
              </button>
            </div>

            {activeAddFoodTab === "search" && (
              <>
                <div className="search-row">
                  <input
                    value={modalQuery}
                    placeholder="Search USDA foods..."
                    onChange={(e) => setModalQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && searchModalFood()}
                  />
                  <button onClick={searchModalFood}>Search</button>
                </div>

                <div className="modal-results">
                  {modalFoods.map((food) => {
                    const resultDisplay = getModalResultCalories(
                      food,
                      selectedFood,
                      selectedFoodDetail,
                      selectedPortion,
                      isLoadingDetail
                    );

                    return (
                      <button
                        className={`food-card ${selectedFood?.id === food.id ? "selected" : ""}`}
                        key={food.id}
                        onClick={() => selectFood(food)}
                      >
                        <strong>{food.name}</strong>
                        <span>Brand: {food.brand || "Generic"}</span>
                        <span>
                          {resultDisplay.isLoading
                            ? "Loading serving details..."
                            : `${resultDisplay.calories} cal per ${resultDisplay.servingSize}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {activeAddFoodTab === "recent" && (
              <div className="modal-results">
                {recentFoods.length === 0 && (
                  <p className="empty-meal">No recent foods logged in the last week.</p>
                )}

                {recentFoods.map((food) => (
                  <button
                    className={`food-card ${selectedFood?.id === food.id ? "selected" : ""}`}
                    key={food.id}
                    onClick={() => selectLocalFood(food)}
                  >
                    <strong>{food.name}</strong>
                    <span>Brand: {food.brand || "Generic"}</span>
                    <span>
                      {food.calories} cal per {food.servingSize}
                    </span>
                    <span>Logged {food.loggedCount} times this week</span>
                  </button>
                ))}
              </div>
            )}

            {activeAddFoodTab === "custom" && (
              <>
                <div className="search-row">
                  <input
                    value={customQuery}
                    placeholder="Search custom foods..."
                    onChange={(e) => setCustomQuery(e.target.value)}
                  />
                  <button type="button" onClick={openCustomFoodForm}>
                    Add custom
                  </button>
                </div>

                {isCustomFormOpen && (
                  <div className="custom-food-form">
                    <label>
                      Name
                      <input
                        value={customFoodForm.name}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Brand
                      <input
                        value={customFoodForm.brand}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, brand: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Serving size
                      <input
                        value={customFoodForm.servingSize}
                        placeholder="1, 30, 0.5"
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, servingSize: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Serving unit
                      <input
                        value={customFoodForm.servingUnit}
                        placeholder="bar, g, cup"
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, servingUnit: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Calories
                      <input
                        type="number"
                        min="0"
                        value={customFoodForm.calories}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, calories: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Protein
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customFoodForm.protein}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, protein: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Carbs
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customFoodForm.carbs}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, carbs: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fat
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customFoodForm.fat}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, fat: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fiber
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={customFoodForm.fiber}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, fiber: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Sodium
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={customFoodForm.sodium}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, sodium: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Notes
                      <textarea
                        value={customFoodForm.notes}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, notes: e.target.value })
                        }
                      />
                    </label>

                    <div className="form-actions">
                      <button type="button" onClick={createCustomFood}>
                        Save food
                      </button>
                      <button type="button" onClick={() => setIsCustomFormOpen(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!isCustomFormOpen && (
                  <div className="modal-results">
                    {filteredCustomFoods.length === 0 && (
                      <p className="empty-meal">No custom foods match this search.</p>
                    )}

                    {filteredCustomFoods.map((food) => (
                      <button
                        className={`food-card ${selectedFood?.id === food.id ? "selected" : ""}`}
                        key={food.id}
                        onClick={() => selectLocalFood(food)}
                      >
                        <strong>{food.name}</strong>
                        <span>Brand: {food.brand || "Generic"}</span>
                        <span>
                          {food.calories} cal per {food.servingSize}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeAddFoodTab === "recipes" && (
              <>
                <div className="search-row">
                  <input
                    value={recipeQuery}
                    placeholder="Search recipes..."
                    onChange={(e) => setRecipeQuery(e.target.value)}
                  />
                  <button type="button" onClick={openRecipeForm}>
                    Add recipe
                  </button>
                </div>

                {isRecipeFormOpen && (
                  <div className="recipe-form">
                    <div className="custom-food-form">
                      <label>
                        Recipe name
                        <input
                          value={recipeForm.name}
                          onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                        />
                      </label>
                      <label>
                        Serving size
                        <input
                          value={recipeForm.servingSize}
                          placeholder="1, 0.5, 250"
                          onChange={(e) =>
                            setRecipeForm({ ...recipeForm, servingSize: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Serving unit
                        <input
                          value={recipeForm.servingUnit}
                          placeholder="serving, bowl, g"
                          onChange={(e) =>
                            setRecipeForm({ ...recipeForm, servingUnit: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        Notes
                        <textarea
                          value={recipeForm.notes}
                          onChange={(e) => setRecipeForm({ ...recipeForm, notes: e.target.value })}
                        />
                      </label>
                    </div>

                    <div className="recipe-builder">
                      <div className="recipe-totals">
                        <strong>{recipeTotals.calories} cal total</strong>
                        <span>
                          {Number(recipeTotals.protein.toFixed(1))}g protein /{" "}
                          {Number(recipeTotals.carbs.toFixed(1))}g carbs /{" "}
                          {Number(recipeTotals.fat.toFixed(1))}g fat
                        </span>
                      </div>

                      <div className="search-row">
                        <input
                          value={recipeIngredientQuery}
                          placeholder="Search USDA and custom foods..."
                          onChange={(e) => setRecipeIngredientQuery(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && searchRecipeIngredientFoods()}
                        />
                        <button type="button" onClick={searchRecipeIngredientFoods}>
                          Search
                        </button>
                      </div>

                      <div className="ingredient-picker">
                        {isSearchingRecipeIngredients && (
                          <p className="empty-meal">Searching foods...</p>
                        )}

                        {recipeIngredientOptions.length === 0 && (
                          <p className="empty-meal">Search USDA, or add custom foods to use as ingredients.</p>
                        )}

                        {recipeIngredientOptions.map((food) => (
                          <button
                            className={pendingRecipeIngredient?.id === food.id ? "selected" : ""}
                            key={food.id}
                            type="button"
                            onClick={() => selectRecipeIngredient(food)}
                          >
                            <strong>{food.name}</strong>
                            <span>
                              {food.calories} cal per {food.servingSize}
                            </span>
                          </button>
                        ))}
                      </div>

                      {pendingRecipeIngredient && (
                        <div className="ingredient-confirm">
                          <div>
                            <strong>{pendingRecipeIngredient.name}</strong>
                            <span>
                              {pendingRecipeIngredient.calories} cal per{" "}
                              {pendingRecipeIngredient.servingSize}
                            </span>
                          </div>
                          <label>
                            Quantity
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={pendingRecipeIngredientQuantity}
                              onChange={(e) => setPendingRecipeIngredientQuantity(e.target.value)}
                            />
                          </label>
                          <button type="button" onClick={confirmRecipeIngredient}>
                            Add ingredient
                          </button>
                          <button type="button" onClick={() => setPendingRecipeIngredient(null)}>
                            Cancel
                          </button>
                        </div>
                      )}

                      <div className="ingredient-list">
                        {recipeIngredients.length === 0 && (
                          <p className="empty-meal">No ingredients added yet.</p>
                        )}

                        {recipeIngredients.map((ingredient) => (
                          <div className="ingredient-row" key={ingredient.food.id}>
                            <span>{ingredient.food.name}</span>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={ingredient.quantity}
                              onChange={(e) =>
                                updateRecipeIngredientQuantity(ingredient.food.id, e.target.value)
                              }
                            />
                            <span>{getIngredientCalories(ingredient)} cal</span>
                            <button type="button" onClick={() => removeRecipeIngredient(ingredient.food.id)}>
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="form-actions">
                        <button type="button" onClick={createRecipe}>
                          Save recipe
                        </button>
                        <button type="button" onClick={() => setIsRecipeFormOpen(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!isRecipeFormOpen && (
                  <div className="modal-results">
                    {filteredRecipes.length === 0 && (
                      <p className="empty-meal">No recipes match this search.</p>
                    )}

                    {filteredRecipes.map((recipe) => (
                      <button
                        className={`food-card ${selectedFood?.id === recipe.id ? "selected" : ""}`}
                        key={recipe.id}
                        onClick={() => selectLocalFood(recipe)}
                      >
                        <strong>{recipe.name}</strong>
                        <span>{recipe.ingredients.length} ingredients</span>
                        <span>
                          {recipe.calories} cal per {recipe.servingSize}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {!isCustomFormOpen && !isRecipeFormOpen && (
              <>
                {selectedFood && (
                  <div className="selected-food-summary">
                    <strong>{selectedFood.name}</strong>
                    {isLoadingDetail && <span>Loading portions...</span>}
                    {detailError && <span className="modal-error">{detailError}</span>}
                  </div>
                )}

                {selectedFood && (
                  <>
                    {usesLocalPortion && (
                      <label className="portion-row">
                        Amount ({getLocalPortionUnit(selectedFood)})
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={portionAmount}
                          onChange={(e) => setPortionAmount(e.target.value)}
                        />
                        <span className="modal-hint">
                          calculated from {selectedFood.servingSize}
                        </span>
                      </label>
                    )}

                    {portionOptions.length > 0 && (
                      <label className="portion-row">
                        Portion
                        <select
                          value={selectedPortionValue}
                          onChange={(e) => setSelectedPortionValue(e.target.value)}
                        >
                          {portionOptions.map((portion) => (
                            <option key={portion.value} value={portion.value}>
                              {portion.label} ({portion.gramWeight}g)
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {!usesLocalPortion && (
                      <label className="quantity-row">
                        Quantity
                        <input
                          type="number"
                          min="0.1"
                          step="0.1"
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </label>
                    )}
                  </>
                )}

                {selectedFood && selectedPortionCalories !== null && (
                  <p className="modal-hint">
                    {selectedPortionCalories} cal per selected serving
                  </p>
                )}

                {selectedFood && (
                  <button className="primary-button" onClick={addSelectedFood} disabled={!canAddSelectedFood}>
                    Add
                  </button>
                )}
                <button className="secondary-button" onClick={closeAddFood}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {itemToRemove && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="remove-food-title">
            <h2 id="remove-food-title">Remove food?</h2>
            <p>
              {itemToRemove.name} x {itemToRemove.quantity} will be removed from{" "}
              {itemToRemove.category}.
            </p>

            <button className="danger-button" onClick={confirmRemoveFood}>
              Remove
            </button>
            <button className="secondary-button" onClick={() => setItemToRemove(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {bottomNav}
    </main>
  );
}

export default App;
