import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { recognize } from "tesseract.js";
import "./App.css";

type Food = {
  id: number;
  name: string;
  brand: string | null;
  category?: string | null;
  dataType?: string | null;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
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

type AppView = "home" | "day" | "library" | "profile" | "weight";

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

type TopFoodEntry = { name: string; count: number };

type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goalWeight?: number;
  goalWeightUnit?: WeightUnit;
  calculatorInputs?: CalculatorInputs;
};

type GoalsForm = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  goalWeight: string;
};

type WeightRange = "1M" | "3M" | "6M" | "1Y" | "All";

type WeightEntry = {
  id: string;
  date: string;
  weight: number;
  unit: WeightUnit;
  note?: string;
};

type WeightForm = {
  date: string;
  weight: string;
  note: string;
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
  sugar: string;
  sodium: string;
  notes: string;
};

type ScannedNutritionFields = Partial<
  Pick<
    CustomFoodForm,
    "servingSize" | "servingUnit" | "calories" | "fat" | "carbs" | "protein" | "sugar" | "fiber" | "sodium"
  >
>;

type RecipeForm = {
  name: string;
  servingSize: string;
  servingUnit: string;
  notes: string;
};

type AmountUnit = "serving" | "g" | "ml" | "oz";
type MeasuredAmountUnit = Exclude<AmountUnit, "serving">;

type DebugLogEntry = {
  time: string;
  event: string;
  detail?: unknown;
};

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

type GoogleAccounts = {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => GoogleTokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

type GoogleDriveUploadResponse = {
  id?: string;
  name?: string;
  webViewLink?: string;
};

const mealCategories = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
const poundsPerKilogram = 2.2046226218;
const debugLogKey = "jessicaDebugLog";
const googleDriveClientIdKey = "googleDriveClientId";
const googleDriveScope = "https://www.googleapis.com/auth/drive.file";
const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";

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
  sugar: "",
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
const maxHeightInches = 108;
const maxHeightCm = maxHeightInches * 2.54;
const maxWeightLb = 1400;
const maxWeightKg = maxWeightLb * 0.45359237;

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

function appendDebugLog(event: string, detail?: unknown) {
  const entry: DebugLogEntry = {
    time: new Date().toISOString(),
    event,
    detail,
  };

  console.info(`[Jessica debug] ${event}`, detail ?? "");

  try {
    const saved = localStorage.getItem(debugLogKey);
    const entries = saved ? (JSON.parse(saved) as DebugLogEntry[]) : [];
    localStorage.setItem(debugLogKey, JSON.stringify([...entries.slice(-29), entry]));
  } catch (error) {
    console.warn("[Jessica debug] Could not persist debug log", error);
  }
}

function getStorageArray<T>(key: string, fallback: T[] = []) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T[]) : fallback;
  } catch (error) {
    appendDebugLog("storage-read-failed", {
      key,
      message: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

function setStorageJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    appendDebugLog("storage-write-failed", {
      key,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function verifyStorageCount(key: string, expectedCount: number) {
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? (JSON.parse(saved) as unknown[]) : [];
    const persisted = Array.isArray(parsed) && parsed.length === expectedCount;
    appendDebugLog("storage-verify", { key, expectedCount, actualCount: parsed.length, persisted });
    return persisted;
  } catch (error) {
    appendDebugLog("storage-verify-failed", {
      key,
      expectedCount,
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

function getSavedLog(date: string) {
  return getStorageArray<SavedLogItem>(`log-${date}`).map((item) => ({
    ...item,
    category: item.category ?? "Snacks",
    quantity: item.quantity ?? 1,
  }));
}

function getSavedCustomFoods() {
  return getStorageArray<Food>("customFoods");
}

function saveCustomFoods(foods: Food[]) {
  setStorageJson("customFoods", foods);
}

function getSavedRecipes() {
  return getStorageArray<Recipe>("recipes");
}

function getSavedWeightEntries() {
  return getStorageArray<WeightEntry>("weightEntries");
}

function saveWeightEntries(entries: WeightEntry[]) {
  setStorageJson("weightEntries", entries);
}

function getSavedCompletedDays(): string[] {
  return getStorageArray<string>("completedDays");
}
function saveCompletedDays(days: string[]): void {
  setStorageJson("completedDays", days);
}
function getSavedTopFoods(): TopFoodEntry[] {
  return getStorageArray<TopFoodEntry>("topFoods");
}
function saveTopFoods(foods: TopFoodEntry[]): void {
  setStorageJson("topFoods", foods);
}

function getSavedGoals(): Goals | null {
  try {
    const saved = localStorage.getItem("goals");
    return saved ? (JSON.parse(saved) as Goals) : null;
  } catch (error) {
    appendDebugLog("storage-read-failed", {
      key: "goals",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function goalsToForm(goals: Goals | null): GoalsForm {
  if (!goals) return { calories: "", protein: "", carbs: "", fat: "", goalWeight: "" };
  return {
    calories: String(goals.calories),
    protein: String(goals.protein),
    carbs: String(goals.carbs),
    fat: String(goals.fat),
    goalWeight: goals.goalWeight ? String(goals.goalWeight) : "",
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
  setStorageJson("recipes", recipes);
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

function isGramUnit(unit: string) {
  return unit === "g" || unit === "ml" || unit === "oz";
}

function normalizeAmountUnit(unit: string): MeasuredAmountUnit | null {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "ml" || normalized === "milliliter" || normalized === "milliliters") return "ml";
  if (normalized === "g" || normalized === "gram" || normalized === "grams") return "g";
  if (normalized === "oz" || normalized === "ounce" || normalized === "ounces") return "oz";
  return null;
}

function getMeasuredServingBasis(food: Food) {
  const basis = parseServingSize(food.servingSize);
  const unit = basis ? normalizeAmountUnit(basis.unit) : null;
  return basis && unit ? { amount: basis.amount, unit } : null;
}

function convertAmountToBasisUnit(amount: number, amountUnit: MeasuredAmountUnit, basisUnit: MeasuredAmountUnit) {
  if (amountUnit === basisUnit) return amount;
  if (amountUnit === "oz" && basisUnit === "g") return amount * 28.349523125;
  if (amountUnit === "g" && basisUnit === "oz") return amount / 28.349523125;
  return null;
}

function getScaleFromServingBasis(food: Food, amount: number) {
  const basis = getMeasuredServingBasis(food);
  if (!basis) return null;

  return amount / basis.amount;
}

function getServingSizeBasis(detail: FoodDetail | null, food: Food) {
  return (
    parseServingSize(detail?.servingSize, detail?.servingSizeUnit ?? "") ??
    parseServingSize(food.servingSize)
  );
}

function hasUsableSearchNutrition(food: Food) {
  const basis = getMeasuredServingBasis(food);
  return Boolean(basis && isGramUnit(basis.unit) && food.calories > 0);
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
    sugar: food.sugar === undefined ? undefined : food.sugar * factor,
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

  if (dataTypeText === "branded") score += 25;
  if (dataTypeText === "foundation" || dataTypeText === "sr legacy" || dataTypeText.includes("survey")) {
    score -= queryWords.length > 2 ? 30 : 0;
  }
  if (searchableText.includes(queryText)) score += 130;
  if (matchedSearchWords.length === queryWords.length) score += 95;
  if (nameText.includes(queryText) || compactName.includes(compactQuery)) score += 100;
  if (synonymMatches.length > 0) score += 95 + synonymMatches.length * 8;
  if (matchedNameWords.length === queryWords.length) score += 70;
  if (nameText.startsWith(queryText)) score += 50;
  if (brandText.includes(queryText) || queryWords.some((word) => brandText.includes(word))) score += 45;
  if (brandText && getSearchTokens(brandText).every((word) => queryWords.includes(word))) score += 40;
  score += matchedSearchWords.length * 16;
  score += matchedNameWords.length * 12;

  if (queryWords.length > 1 && matchedSearchWords.length === 1) score -= 45;
  if (matchedSearchWords.length === 0 && !brandText.includes(queryText)) score -= 60;

  return score;
}

function rankSearchResults(foods: Food[], query: string) {
  return [...foods].sort((a, b) => getFoodSearchScore(b, query) - getFoodSearchScore(a, query));
}

function detectMilkType(food: Food) {
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

function formatDisplayName(name: string) {
  const trimmedName = name.trim();
  const hasLetters = /[a-z]/i.test(trimmedName);
  const isAllCaps = hasLetters && trimmedName === trimmedName.toUpperCase();

  if (!isAllCaps) return trimmedName;

  return trimmedName
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bUsda\b/g, "USDA");
}

function getFoodDisplayName(food: Food) {
  const milkType = detectMilkType(food);

  if (!milkType) return formatDisplayName(food.name);

  return `Milk, ${milkType.replace(" Milk", "")}`;
}

function getBrandDisplayName(brand: string | null | undefined) {
  return brand ? formatDisplayName(brand) : "Generic";
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

function getIngredientMacro(
  ingredient: RecipeIngredient,
  key: "protein" | "carbs" | "fat" | "fiber" | "sugar" | "sodium"
) {
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
    sugar: totals.sugar,
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
    sugar: String(food.sugar ?? 0),
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
    id: -Date.now(),
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

function normalizeOcrText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseOcrNumber(value: string) {
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

function formatScannedNumber(value: number, decimals = 1) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(decimals)));
}

function getNutritionLine(text: string, labelPattern: RegExp) {
  return text.split("\n").find((line) => labelPattern.test(line.toLowerCase())) ?? "";
}

function extractNutritionAmount(text: string, labelPattern: RegExp, unit: "g" | "mg" | "any" = "g") {
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

function extractCalories(text: string) {
  const line = getNutritionLine(text, /\bcalories\b/);
  const match = line.match(/\bcalories\b\D{0,12}(\d{1,4})\b/i) ?? line.match(/\b(\d{1,4})\b/);
  const calories = match ? parseOcrNumber(match[1]) : null;

  return calories === null ? "" : formatScannedNumber(calories, 0);
}

function extractServingSize(text: string) {
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

function parseNutritionLabelText(text: string): ScannedNutritionFields {
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
    return Number.isFinite(height) && height > 0 && height <= maxHeightCm ? height : null;
  }

  if (inputs.heightUnit === "in") {
    const height = Number(inputs.height);
    return Number.isFinite(height) && height > 0 && height <= maxHeightInches
      ? height * 2.54
      : null;
  }

  const feet = Number(inputs.heightFeet || 0);
  const inches = Number(inputs.heightInches || 0);

  if (!Number.isFinite(feet) || !Number.isFinite(inches) || feet < 0 || inches < 0) return null;

  const totalInches = feet * 12 + inches;
  return totalInches > 0 && totalInches <= maxHeightInches ? totalInches * 2.54 : null;
}

function calculateGoalsFromInputs(inputs: CalculatorInputs): Goals | null {
  const age = Number(inputs.age);
  const weight = Number(inputs.weight);
  const heightCm = getHeightCm(inputs);
  const weightKg = inputs.weightUnit === "kg" ? weight : weight * 0.45359237;

  if (
    !Number.isFinite(age) ||
    age < 18 ||
    age > 120 ||
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isFinite(weightKg) ||
    weightKg > maxWeightKg ||
    heightCm === null
  ) {
    return null;
  }

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

function getHeightValidationMessage(inputs: CalculatorInputs) {
  if (inputs.heightUnit === "ftIn") {
    const hasHeightInput = Boolean(inputs.heightFeet || inputs.heightInches);
    if (!hasHeightInput) return "";

    const feet = Number(inputs.heightFeet || 0);
    const inches = Number(inputs.heightInches || 0);
    const totalInches = feet * 12 + inches;

    if (
      !Number.isFinite(feet) ||
      !Number.isFinite(inches) ||
      feet < 0 ||
      inches < 0 ||
      inches >= 12 ||
      totalInches <= 0 ||
      totalInches > maxHeightInches
    ) {
      return "Please enter a valid height.";
    }

    return "";
  }

  if (!inputs.height) return "";

  const height = Number(inputs.height);
  const maxHeight = inputs.heightUnit === "cm" ? maxHeightCm : maxHeightInches;

  if (!Number.isFinite(height) || height <= 0 || height > maxHeight) {
    return "Please enter a valid height.";
  }

  return "";
}

function getWeightValidationMessage(inputs: CalculatorInputs) {
  if (!inputs.weight) return "";

  const weight = Number(inputs.weight);
  const maxWeight = inputs.weightUnit === "kg" ? maxWeightKg : maxWeightLb;

  if (!Number.isFinite(weight) || weight <= 0 || weight > maxWeight) {
    return "Please enter a valid weight.";
  }

  return "";
}

function getWeekDates(referenceDate: string) {
  const [year, month, day] = referenceDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  const dow = d.getDay();
  const daysToMonday = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => shiftDate(referenceDate, daysToMonday + i));
}

function formatShortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatEntryDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekOf(start: string, end: string): string {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const s = new Date(sy, sm - 1, sd);
  const e = new Date(ey, em - 1, ed);
  return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

function getDayLetter(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun
  return ["S", "M", "T", "W", "R", "F", "S"][dow];
}

function formatDateRange(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  const sameYear = start.getFullYear() === end.getFullYear();

  return sameYear
    ? `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
}

function formatWeightValue(weight: number, unit: WeightUnit) {
  return `${Number(weight.toFixed(1))} ${unit}`;
}

function convertWeightValue(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit) {
  if (fromUnit === toUnit) return weight;
  if (fromUnit === "kg" && toUnit === "lb") return weight * poundsPerKilogram;
  if (fromUnit === "lb" && toUnit === "kg") return weight / poundsPerKilogram;
  return weight;
}

function formatWeightValueInUnit(weight: number, fromUnit: WeightUnit, toUnit: WeightUnit) {
  return formatWeightValue(convertWeightValue(weight, fromUnit, toUnit), toUnit);
}

function roundToIncrement(value: number, increment: number) {
  return Math.round(value / increment) * increment;
}

function getNiceWeightStep(range: number) {
  return range <= 6 ? 0.5 : 1;
}

function getWeightTickLabel(value: number, step: number, unit: WeightUnit) {
  const precision = step === 0.5 ? 1 : 0;
  return `${Number(value.toFixed(precision))} ${unit}`;
}

function sortWeightEntriesNewestFirst(entries: WeightEntry[]) {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function sortWeightEntriesOldestFirst(entries: WeightEntry[]) {
  return [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function getPreferredWeightUnit(goals: Goals | null): WeightUnit {
  return goals?.calculatorInputs?.weightUnit ?? "lb";
}

function getWeightRangeStartDate(range: WeightRange, referenceDate: string) {
  if (range === "All") return "";

  const [year, month, day] = referenceDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const monthOffsets: Record<Exclude<WeightRange, "All">, number> = {
    "1M": 1,
    "3M": 3,
    "6M": 6,
    "1Y": 12,
  };

  date.setMonth(date.getMonth() - monthOffsets[range]);
  return date.toISOString().slice(0, 10);
}

function getWeightRangeLabel(range: WeightRange) {
  return range;
}

function parseDecimalInput(value: string) {
  return Number(value.trim().replace(",", "."));
}

function createClientId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? Array.from(crypto.getRandomValues(new Uint32Array(2)), (value) => value.toString(36)).join("")
      : Math.random().toString(36).slice(2);

  return `${Date.now().toString(36)}-${randomPart}`;
}

function getConfiguredGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem(googleDriveClientIdKey) || "";
}

function App() {
  const today = getLocalDateString();
  const customFoodScanInputRef = useRef<HTMLInputElement | null>(null);
  const mealCardRefs = useRef<Partial<Record<MealCategory, HTMLElement | null>>>({});
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
  const [goals, setGoals] = useState<Goals | null>(() => getSavedGoals());
  const [goalsForm, setGoalsForm] = useState<GoalsForm>(() => goalsToForm(getSavedGoals()));
  const [calculatorInputs, setCalculatorInputs] = useState<CalculatorInputs>(() =>
    calculatorInputsToForm(getSavedGoals())
  );
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
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(() => !getSavedGoals());
  const [isManualGoalsOpen, setIsManualGoalsOpen] = useState(false);
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
  const [itemToEdit, setItemToEdit] = useState<LogItem | null>(null);
  const [editItemQuantity, setEditItemQuantity] = useState("1");
  const [editItemServingSize, setEditItemServingSize] = useState("");
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("serving");
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportDriveLink, setExportDriveLink] = useState("");
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [googleDriveClientId, setGoogleDriveClientId] = useState(() => getConfiguredGoogleClientId());

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
    setCompletedDays((prev) => (
      prev.includes(selectedDate) ? prev : [...prev, selectedDate]
    ));
    setStreakPopupDate(selectedDate);
    setShowStreakPopup(true);
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

    setModalFoods(await searchUsdaFoodsWithSynonyms(modalQuery));
  }

  async function selectFood(food: Food) {
    const measuredBasis = getMeasuredServingBasis(food);
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(measuredBasis?.amount ?? parseServingSize(food.servingSize)?.amount ?? 1));
    setAmountUnit(measuredBasis?.unit ?? "serving");
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

    setLog([
      ...log,
      {
        ...displayFoodServing,
        category: pendingCategory,
        quantity: selectedServings,
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

  function openEditFoodItem(item: LogItem) {
    setItemToEdit(item);
    setEditItemQuantity(String(item.quantity));
    setEditItemServingSize(item.servingSize);
  }

  function saveEditedFoodItem() {
    if (!itemToEdit) return;

    const quantity = parseDecimalInput(editItemQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return;

    setLog(
      log.map((item) =>
        item.logId === itemToEdit.logId
          ? {
              ...item,
              quantity,
              servingSize: editItemServingSize.trim() || item.servingSize,
            }
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

  function getDayExportData() {
    const meals = mealCategories.map((category) => {
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

  async function shareDayExport() {
    setExportDriveLink("");
    const file = getDayExportFile();
    const shareData = {
      title: `Food Log ${selectedDate}`,
      text: `Food log for ${selectedDate}`,
      files: [file],
    };

    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setExportStatus("Shared. Choose Google Drive from the share sheet to save it there.");
        return;
      }

      setExportStatus("File sharing is not available in this browser. Use Download JSON instead.");
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Share canceled or failed.");
    }
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

  async function getGoogleDriveAccessToken(clientId: string) {
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

  async function uploadDayExportToDrive() {
    if (isUploadingToDrive) return;

    const clientId = googleDriveClientId.trim();
    setExportDriveLink("");

    if (!clientId) {
      setExportStatus("Add your Google OAuth Client ID first.");
      return;
    }

    localStorage.setItem(googleDriveClientIdKey, clientId);
    setExportStatus("Opening Google authorization...");
    setIsUploadingToDrive(true);

    try {
      const accessToken = await getGoogleDriveAccessToken(clientId);
      const file = getDayExportFile();
      const metadata = {
        name: file.name,
        mimeType: "application/json",
      };
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

      setExportStatus("Uploading to Google Drive...");

      const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      });

      if (!response.ok) {
        throw new Error(await getGoogleDriveUploadError(response));
      }

      const uploaded = (await response.json()) as GoogleDriveUploadResponse;
      setExportDriveLink(uploaded.webViewLink ?? "");
      setExportStatus(`Uploaded ${uploaded.name ?? file.name} to Google Drive.`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : "Google Drive upload failed.");
    } finally {
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

  function openDebugPanel() {
    setDebugLogText(getDebugLogText());
    setDebugCopyStatus("");
    setIsDebugPanelOpen(true);
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

  function submitGoals() {
    const calories = Number(goalsForm.calories);
    const protein = Number(goalsForm.protein);
    const carbs = Number(goalsForm.carbs);
    const fat = Number(goalsForm.fat);

    if (!Number.isFinite(calories) || calories <= 0) return;
    if (![protein, carbs, fat].every((v) => Number.isFinite(v) && v >= 0)) return;

    const newGoals: Goals = {
      calories: Math.round(calories),
      protein,
      carbs,
      fat,
      ...(goalsForm.goalWeight && Number(goalsForm.goalWeight) > 0
        ? { goalWeight: Number(goalsForm.goalWeight), goalWeightUnit: weightUnit }
        : {}),
      calculatorInputs: goals?.calculatorInputs,
    };
    setGoals(newGoals);
    setStorageJson("goals", newGoals);
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
    setStorageJson("goals", newGoals);
    setIsCalculatorOpen(false);
    setIsManualGoalsOpen(false);
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
  const localPortionAmount = Number(portionAmount);
  const measuredServingBasis = selectedFood ? getMeasuredServingBasis(selectedFood) : null;
  const allowedAmountUnits = selectedFood && measuredServingBasis
    ? [measuredServingBasis.unit]
    : (["serving"] as AmountUnit[]);
  const portionAmountInBasisUnits =
    measuredServingBasis && amountUnit !== "serving"
      ? convertAmountToBasisUnit(localPortionAmount, amountUnit, measuredServingBasis.unit)
      : localPortionAmount;
  const localPortionScale =
    selectedFood &&
    hasUsableSearchNutrition(selectedFood) &&
    Number.isFinite(localPortionAmount) &&
    localPortionAmount > 0 &&
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
  const canAddSelectedFood =
    Boolean(selectedFood) &&
    !isLoadingDetail &&
    (amountUnit === "serving" || (allowedAmountUnits.includes(amountUnit) && localPortionScale !== null)) &&
    (portionOptions.length === 0 || Boolean(selectedPortion));
  const calculatedGoals = calculateGoalsFromInputs(calculatorInputs);
  const calculatorRates = getValidRates(calculatorInputs.goal);
  const ageValidationMessage = getAgeValidationMessage(calculatorInputs.age);
  const heightValidationMessage = getHeightValidationMessage(calculatorInputs);
  const weightValidationMessage = getWeightValidationMessage(calculatorInputs);

  const bottomNav = (
    <>
      <button type="button" className="debug-fab" onClick={openDebugPanel}>
        Debug
      </button>
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
          className={appView === "weight" ? "active" : ""}
          onClick={() => { setLibrarySelection(null); cancelLibraryEditing(); setAppView("weight"); }}
        >
          <span className="nav-icon">↕</span>
          <span>Weight</span>
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
      {isDebugPanelOpen && (
        <div className="modal-backdrop debug-backdrop" role="presentation">
          <div className="modal debug-panel" role="dialog" aria-modal="true" aria-labelledby="debug-panel-title">
            <div className="debug-panel-header">
              <h2 id="debug-panel-title">Debug Log</h2>
              <button type="button" className="secondary-button" onClick={() => setIsDebugPanelOpen(false)}>
                Close
              </button>
            </div>
            <textarea readOnly value={debugLogText} />
            {debugCopyStatus && <p className="scan-status">{debugCopyStatus}</p>}
            <div className="form-actions">
              <button type="button" onClick={copyDebugLog}>
                Copy Log
              </button>
              <button type="button" className="danger-button" onClick={clearDebugLog}>
                Clear Log
              </button>
            </div>
          </div>
        </div>
      )}
      {showStreakPopup && (() => {
        const popupWeekDates = getWeekDates(streakPopupDate);
        const popupCompletedDays = completedDays.includes(streakPopupDate)
          ? completedDays
          : [...completedDays, streakPopupDate];
        const completedSet = new Set(popupCompletedDays);
        return (
          <div className="floating-overlay" role="presentation" onClick={() => setShowStreakPopup(false)}>
            <div className="floating-popover streak-popup" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <h2 className="streak-popup-title">Day Logged!</h2>
              <div className="streak-popup-num">{getCompletedStreak(streakPopupDate, popupCompletedDays)}</div>
              <p className="streak-popup-label">day streak</p>
              <div className="streak-week-grid">
                {popupWeekDates.map((d) => {
                  const done = completedSet.has(d);
                  const letter = getDayLetter(d);
                  return (
                    <div key={d} className={`streak-day-cell${done ? " done" : ""}`}>
                      <span className="streak-day-check">{done ? "✓" : ""}</span>
                      <span className="streak-day-letter">{letter}</span>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="primary-button" onClick={() => setShowStreakPopup(false)}>
                Close
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );

  if (appView === "home") {
    const weekDates = getWeekDates(selectedDate);
    const weekStats = weekDates.map((date) => {
      const dayLog = date === selectedDate ? log : getSavedLog(date);
      return {
        date,
        calories: dayLog.reduce((s, item) => s + Math.round(item.calories * (item.quantity ?? 1)), 0),
        protein: dayLog.reduce((s, item) => s + item.protein * (item.quantity ?? 1), 0),
        carbs: dayLog.reduce((s, item) => s + item.carbs * (item.quantity ?? 1), 0),
        fat: dayLog.reduce((s, item) => s + item.fat * (item.quantity ?? 1), 0),
      };
    });

    const goalCal = goals?.calories ?? 0;
    const maxDayCalories = Math.max(...weekStats.map((d) => d.calories), 1);
    const weekCalorieGoal = goalCal * 7;
    const weekTotalCalories = weekStats.reduce((s, d) => s + d.calories, 0);
    const weekTotalProtein = weekStats.reduce((s, d) => s + d.protein, 0);
    const weekTotalCarbs = weekStats.reduce((s, d) => s + d.carbs, 0);
    const weekTotalFat = weekStats.reduce((s, d) => s + d.fat, 0);
    const selectedHomeStats = homeSelectedDate
      ? weekStats.find((day) => day.date === homeSelectedDate) ?? null
      : null;
    const displayStats = selectedHomeStats ?? {
      date: weekDates[0],
      calories: weekTotalCalories,
      protein: weekTotalProtein,
      carbs: weekTotalCarbs,
      fat: weekTotalFat,
    };
    const displayGoalCal = selectedHomeStats ? goalCal : weekCalorieGoal;
    const remaining = displayGoalCal - displayStats.calories;

    const totalMacroGrams = displayStats.fat + displayStats.carbs + displayStats.protein;
    const macroPieSlices = [
      { label: "Protein", value: displayStats.protein, color: "#a32c2c" },
      { label: "Carbs", value: displayStats.carbs, color: "#2e44b3" },
      { label: "Fat", value: displayStats.fat, color: "#ffbb00" },
    ].reduce(
      (slices, macro) => {
        if (totalMacroGrams <= 0 || macro.value <= 0) return slices;

        const startAngle = slices.at(-1)?.endAngle ?? -90;
        const angle = (macro.value / totalMacroGrams) * 360;
        const endAngle = startAngle + angle;
        const midAngle = startAngle + angle / 2;
        const startRad = (Math.PI / 180) * startAngle;
        const endRad = (Math.PI / 180) * endAngle;
        const midRad = (Math.PI / 180) * midAngle;
        const largeArc = angle > 180 ? 1 : 0;
        const startX = 50 + 48 * Math.cos(startRad);
        const startY = 50 + 48 * Math.sin(startRad);
        const endX = 50 + 48 * Math.cos(endRad);
        const endY = 50 + 48 * Math.sin(endRad);
        const labelX = 50 + 27 * Math.cos(midRad);
        const labelY = 50 + 27 * Math.sin(midRad);

        return [
          ...slices,
          {
            ...macro,
            endAngle,
            percentage: Math.round((macro.value / totalMacroGrams) * 100),
            path: `M 50 50 L ${startX} ${startY} A 48 48 0 ${largeArc} 1 ${endX} ${endY} Z`,
            labelX,
            labelY,
          },
        ];
      },
      [] as {
        label: string;
        value: number;
        color: string;
        endAngle: number;
        percentage: number;
        path: string;
        labelX: number;
        labelY: number;
      }[]
    );

    const completedStreak = getCompletedStreak();
    const weekLabel = formatWeekOf(weekDates[0], weekDates[6]);
    const calPct = displayGoalCal > 0
      ? Math.min(100, Math.round((displayStats.calories / displayGoalCal) * 100))
      : 0;
    const calorieBudgetMarkerPct = 75;
    const calorieOverflowCapacity = goalCal * 0.35;

    return (
      <main className="app">
        {/* Week navigation */}
        <div className="dash-week-nav">
          <button type="button" className="dash-week-arrow" onClick={() => { setHomeSelectedDate(null); changeSelectedDate(shiftDate(selectedDate, -7)); }} aria-label="Previous week">‹</button>
          <span className="dash-week-label">Week of: {weekLabel}</span>
          <button type="button" className="dash-week-arrow" onClick={() => { setHomeSelectedDate(null); changeSelectedDate(shiftDate(selectedDate, 7)); }} aria-label="Next week">›</button>
        </div>

        {/* CALORIES CARD */}
        <section className="panel dash-card">
          <p className="dash-card-label">CALORIES</p>
          <div className="dash-cal-hero">
            <div className="dash-cal-bar-bg">
              <div className="dash-cal-bar-fill" style={{ width: `${calPct}%` }} />
            </div>
            <span className="dash-cal-number" style={{ color: remaining < 0 ? "#f87171" : "#f3f4f6" }}>
              {displayStats.calories.toLocaleString()}
            </span>
            <span className="dash-cal-sub">
              {displayGoalCal > 0
                ? (remaining >= 0 ? `${remaining.toLocaleString()} remaining` : `${Math.abs(remaining).toLocaleString()} over`)
                : "calories eaten"}
            </span>
          </div>
          <div className="dash-day-bars" aria-label="Weekly calorie bars">
            {weekStats.map(({ date, calories }) => {
              const isSel = date === homeSelectedDate;
              const isToday = date === today;
              const greenPct = goalCal > 0
                ? Math.min(calorieBudgetMarkerPct, (calories / goalCal) * calorieBudgetMarkerPct)
                : Math.min(100, (calories / maxDayCalories) * 100);
              const redPct = goalCal > 0 && calories > goalCal
                ? Math.min(100 - calorieBudgetMarkerPct, ((calories - goalCal) / calorieOverflowCapacity) * (100 - calorieBudgetMarkerPct))
                : 0;
              const dayLetter = getDayLetter(date);
              return (
                <button key={date} type="button"
                  className={`dash-day-col${isSel ? " selected" : ""}`}
                  aria-pressed={isSel}
                  onClick={() => toggleHomeDate(date)}>
                  <div className={`dash-bar-wrap dash-budget-wrap${isSel ? " sel" : ""}`}>
                    <div className="dash-budget-marker" style={{ bottom: `${calorieBudgetMarkerPct}%` }} />
                    <div className={`dash-cal-budget-fill${isToday ? " today" : ""}`} style={{ height: `${greenPct}%` }} />
                    {redPct > 0 && (
                      <div className="dash-cal-over-fill" style={{ bottom: `${calorieBudgetMarkerPct}%`, height: `${redPct}%` }} />
                    )}
                  </div>
                  <span className={`dash-bar-day${isSel ? " sel" : ""}${isToday ? " today" : ""}`}>{dayLetter}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* MACROS CARD */}
        <section className="panel dash-card dash-macro-card">
          <div className="dash-macro-layout">
            <div className="dash-pie-wrap">
              <svg viewBox="0 0 100 100" className="dash-pie-chart" role="img" aria-label="Macro split">
                {macroPieSlices.length > 0 ? (
                  macroPieSlices.map((slice) => (
                    <g key={slice.label}>
                      <path d={slice.path} fill={slice.color} />
                      <text x={slice.labelX} y={slice.labelY - 2} textAnchor="middle" className="dash-pie-label-name">
                        {slice.label}
                      </text>
                      <text x={slice.labelX} y={slice.labelY + 8} textAnchor="middle" className="dash-pie-label-pct">
                        {slice.percentage}%
                      </text>
                    </g>
                  ))
                ) : (
                  <circle cx="50" cy="50" r="48" fill="#3E505B" />
                )}
              </svg>
            </div>
            <div className="dash-macro-side">
              <div className="dash-macro-meter-col" aria-label="Weekly macro composition bars">
                {weekStats.map(({ date, protein, carbs, fat }) => {
                  const isSel = date === homeSelectedDate;
                  const isToday = date === today;
                  const total = protein + carbs + fat;

                  return (
                    <button
                      key={date}
                      type="button"
                      className={`dash-day-col${isSel ? " selected" : ""}`}
                      aria-pressed={isSel}
                      onClick={() => toggleHomeDate(date)}
                    >
                      <div className={`dash-macro-meter${isSel ? " sel" : ""}${isToday ? " today" : ""}${total > 0 ? " logged" : ""}`}>
                        {total > 0 ? (
                          <div className="dash-macro-meter-fill">
                            {protein > 0 && <div style={{ flex: protein, background: "#a32c2c" }} />}
                            {carbs > 0 && <div style={{ flex: carbs, background: "#2e44b3" }} />}
                            {fat > 0 && <div style={{ flex: fat, background: "#ffbb00" }} />}
                          </div>
                        ) : (
                          <div className="dash-macro-meter-empty" />
                        )}
                      </div>
                      <span className={`dash-bar-day${isSel ? " sel" : ""}${isToday ? " today" : ""}`}>{getDayLetter(date)}</span>
                    </button>
                  );
                })}
              </div>
              <p className="dash-macro-summary-line" aria-label="Macro breakdown">
                <span><b style={{ color: "#c75c56" }}>P</b> {Math.round(displayStats.protein)}g</span>
                <span><b style={{ color: "#7088d1" }}>C</b> {Math.round(displayStats.carbs)}g</span>
                <span><b style={{ color: "#ffe066" }}>F</b> {Math.round(displayStats.fat)}g</span>
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CARDS */}
        <section className="dash-bottom-grid">
          {/* Top Left: Streak */}
          <div className="panel dash-card dash-mini-card">
            <p className="dash-quad-label">Streak</p>
            <strong className="dash-streak-num">{completedStreak > 0 ? completedStreak : "—"}</strong>
            <span className="dash-quad-sub">days completed</span>
          </div>

          {/* Top Right: Weekly Macro Goals */}
          <div className="panel dash-card dash-mini-card">
            <div className="dash-card-title-row">
              <p className="dash-quad-label">Goals</p>
              <div className="dash-goals-toggle" aria-label="Goal range">
                <button
                  type="button"
                  className={goalsView === "daily" ? "active" : ""}
                  onClick={() => setGoalsView("daily")}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={goalsView === "weekly" ? "active" : ""}
                  onClick={() => setGoalsView("weekly")}
                >
                  Weekly
                </button>
              </div>
            </div>
            {goals ? (
              <div className="dash-macro-progress-list">
                {[
                  { label: "Protein", total: goalsView === "weekly" ? weekTotalProtein : displayStats.protein, goal: goals.protein * (goalsView === "weekly" ? 7 : 1), color: "#a32c2c", overflowColor: "#ef4444" },
                  { label: "Carbs", total: goalsView === "weekly" ? weekTotalCarbs : displayStats.carbs, goal: goals.carbs * (goalsView === "weekly" ? 7 : 1), color: "#2e44b3", overflowColor: "#60a5fa" },
                  { label: "Fat", total: goalsView === "weekly" ? weekTotalFat : displayStats.fat, goal: goals.fat * (goalsView === "weekly" ? 7 : 1), color: "#ffbb00", overflowColor: "#f97316" },
                ].map(({ label, total, goal, color, overflowColor }) => {
                  const markerPct = 80;
                  const goalFillPct = goal > 0 ? Math.min(markerPct, (total / goal) * markerPct) : 0;
                  const overflowPct = goal > 0 && total > goal
                    ? Math.min(100 - markerPct, ((total - goal) / (goal * 0.25 || 1)) * (100 - markerPct))
                    : 0;
                  return (
                    <div key={label} className="dash-macro-prog-row">
                      <div className="dash-macro-prog-head">
                        <span className="dash-macro-prog-label">{label}</span>
                        <span className="dash-macro-prog-pct">
                          {goal > 0 ? `${Math.round((total / goal) * 100)}% / ${Math.round(total)}g` : `${Math.round(total)}g`}
                        </span>
                      </div>
                      <div className="dash-macro-prog-track">
                        <div className="dash-goal-marker" style={{ left: `${markerPct}%` }} />
                        <div className="dash-macro-prog-fill" style={{ width: `${goalFillPct}%`, background: color }} />
                        {overflowPct > 0 && (
                          <div
                            className="dash-macro-prog-over"
                            style={{ left: `${markerPct}%`, width: `${overflowPct}%`, background: overflowColor }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="dash-quad-sub">Set goals in Profile</p>
            )}
          </div>

          {/* Bottom Left: Weight */}
          <div className="panel dash-card dash-mini-card">
            <p className="dash-quad-label">Weight</p>
            {currentWeightEntry ? (
              <>
                <strong className="dash-weight-num">
                  {formatWeightValueInUnit(currentWeightEntry.weight, currentWeightEntry.unit, weightUnit)}
                </strong>
                {startingWeightEntry && startingWeightEntry.id !== currentWeightEntry.id && (() => {
                  const cur = convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, weightUnit);
                  const start = convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, weightUnit);
                  const diff = cur - start;
                  return (
                    <span className="dash-quad-sub" style={{ color: diff <= 0 ? "#c75c56" : "#f87171" }}>
                      {diff < 0 ? `↓ ${formatWeightValue(Math.abs(diff), weightUnit)} lost` : `↑ ${formatWeightValue(diff, weightUnit)} gained`}
                    </span>
                  );
                })()}
                {goals?.goalWeight && (() => {
                  const cur = convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, weightUnit);
                  const goal = goals.goalWeightUnit
                    ? convertWeightValue(goals.goalWeight, goals.goalWeightUnit, weightUnit)
                    : goals.goalWeight;
                  const remaining = Math.abs(cur - goal);
                  const pct = startingWeightEntry
                    ? Math.min(100, Math.max(0, Math.round(
                        Math.abs(cur - convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, weightUnit)) /
                        Math.abs(goal - convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, weightUnit)) * 100
                      )))
                    : 0;
                  return (
                    <>
                      <span className="dash-quad-sub">Goal: {formatWeightValue(goal, weightUnit)}</span>
                      <div className="dash-macro-prog-track" style={{ marginTop: "0.3rem" }}>
                        <div className="dash-macro-prog-fill" style={{ width: `${pct}%`, background: "#8AB0AB" }} />
                      </div>
                      <span className="dash-quad-sub">{formatWeightValue(remaining, weightUnit)} remaining</span>
                    </>
                  );
                })()}
                {!goals?.goalWeight && (
                  <span className="dash-quad-sub">Last: {formatShortDate(currentWeightEntry.date)}</span>
                )}
              </>
            ) : (
              <span className="dash-quad-sub">No entries yet</span>
            )}
          </div>

          {/* Bottom Right: Top 3 Foods */}
          <div className="panel dash-card dash-mini-card">
            <p className="dash-quad-label">Top Foods</p>
            {topFoods.length > 0 ? (
              <ol className="dash-top-foods">
                {topFoods.slice(0, 3).map((f, index) => (
                  <li key={f.name} className="dash-top-food-item">
                    <span className="dash-food-name">{index + 1}. {f.name}</span>
                    <span className="dash-food-count">×{f.count}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <span className="dash-quad-sub">Log foods to see top items</span>
            )}
          </div>
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
                            max="9"
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
                            max="11.5"
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
                          max={
                            calculatorInputs.heightUnit === "cm"
                              ? Number(maxHeightCm.toFixed(2))
                              : maxHeightInches
                          }
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
                        max={
                          calculatorInputs.weightUnit === "kg"
                            ? Number(maxWeightKg.toFixed(1))
                            : maxWeightLb
                        }
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
                {heightValidationMessage && (
                  <p className="profile-warning">{heightValidationMessage}</p>
                )}
                {weightValidationMessage && (
                  <p className="profile-warning">{weightValidationMessage}</p>
                )}
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

              <label key="goalWeight">
                Goal Weight
                <div className="goals-input-row">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={goalsForm.goalWeight}
                    onChange={(e) => setGoalsForm({ ...goalsForm, goalWeight: e.target.value })}
                  />
                  <span>{weightUnit}</span>
                </div>
              </label>

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

  if (appView === "weight") {
    const displayUnit = weightUnit;
    const chartWidth = 360;
    const chartHeight = 240;
    const chartLeft = 60;
    const chartRight = 24;
    const chartTop = 18;
    const chartBottom = 48;
    const chartPlotWidth = chartWidth - chartLeft - chartRight;
    const chartPlotHeight = chartHeight - chartTop - chartBottom;
    const chartEntries = chartWeightEntries.map((entry) => ({
      ...entry,
      displayWeight: convertWeightValue(entry.weight, entry.unit, displayUnit),
    }));
    const chartWeights = chartEntries.map((entry) => entry.displayWeight);
    const minDisplayWeight = chartWeights.length ? Math.min(...chartWeights) : 0;
    const maxDisplayWeight = chartWeights.length ? Math.max(...chartWeights) : 0;
    const chartRange = Math.max(1, maxDisplayWeight - minDisplayWeight);
    const chartStep = getNiceWeightStep(chartRange);
    const chartMin = roundToIncrement(minDisplayWeight, chartStep) - chartStep;
    const chartMax = roundToIncrement(maxDisplayWeight, chartStep) + chartStep;
    const chartDomainRange = Math.max(chartStep, chartMax - chartMin);
    const chartTickValues = [
      chartMin,
      chartMin + chartDomainRange * 0.25,
      chartMin + chartDomainRange * 0.5,
      chartMin + chartDomainRange * 0.75,
      chartMax,
    ].map((value) => roundToIncrement(value, chartStep));
    const chartExtraTickValues = [
      chartMin + chartDomainRange * 0.125,
      chartMin + chartDomainRange * 0.375,
      chartMin + chartDomainRange * 0.625,
      chartMin + chartDomainRange * 0.875,
    ].map((value) => roundToIncrement(value, chartStep));
    const chartXIndexMid = Math.round((chartEntries.length - 1) / 2);
    const chartPoints = chartEntries.map((entry, index) => {
      const x = chartLeft + (index / Math.max(1, chartEntries.length - 1)) * chartPlotWidth;
      const y = chartTop + ((chartMax - entry.displayWeight) / chartDomainRange) * chartPlotHeight;

      return { ...entry, x, y };
    });
    const chartLinePoints = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
    const chartYAxisTicks = [...new Set(chartTickValues)];
    for (const value of chartExtraTickValues) {
      if (chartYAxisTicks.length >= 5) break;
      if (!chartYAxisTicks.includes(value)) {
        chartYAxisTicks.push(value);
      }
    }
    chartYAxisTicks.sort((a, b) => a - b);
    const chartYAxisPositions = chartYAxisTicks.map((value) => chartTop + ((chartMax - value) / chartDomainRange) * chartPlotHeight);
    const chartXAxisPositions = [
      chartPoints[0]?.x ?? chartLeft,
      chartPoints[chartXIndexMid]?.x ?? chartLeft,
      chartPoints[chartPoints.length - 1]?.x ?? chartLeft,
    ];
    const chartFirstDate = chartEntries[0]?.date ?? "";
    const chartMiddleDate = chartEntries[chartXIndexMid]?.date ?? "";
    const chartLastDate = chartEntries[chartEntries.length - 1]?.date ?? "";
    const chartRangeLabel =
      chartEntries.length > 0 ? formatDateRange(chartFirstDate, chartLastDate) : "No entries";
    const chartHighest = chartEntries.length > 0 ? Math.max(...chartWeights) : 0;
    const chartLowest = chartEntries.length > 0 ? Math.min(...chartWeights) : 0;
    const chartAverage =
      chartEntries.length > 0
        ? chartWeights.reduce((sum, value) => sum + value, 0) / chartEntries.length
        : 0;
    const chartDelta =
      chartEntries.length > 1
        ? chartEntries[chartEntries.length - 1].displayWeight - chartEntries[0].displayWeight
        : null;
    const selectedChartPoint =
      chartPoints.find((point) => point.id === weightChartPointId) ?? chartPoints[chartPoints.length - 1] ?? null;
    const summaryCurrentWeight = currentWeightEntry
      ? convertWeightValue(currentWeightEntry.weight, currentWeightEntry.unit, displayUnit)
      : null;
    const summaryStartingWeight = startingWeightEntry
      ? convertWeightValue(startingWeightEntry.weight, startingWeightEntry.unit, displayUnit)
      : null;
    const summaryChange =
      summaryCurrentWeight !== null && summaryStartingWeight !== null
        ? summaryCurrentWeight - summaryStartingWeight
        : null;
    const summaryChangeLabel =
      summaryChange === null
        ? "No entry"
        : summaryChange === 0
        ? "No change"
        : summaryChange < 0
        ? `Lost ${formatWeightValue(Math.abs(summaryChange), displayUnit)}`
        : `Gained ${formatWeightValue(summaryChange, displayUnit)}`;

    return (
      <main className="app">
        <div className="top-bar">
          <h1>Weight</h1>
        </div>

        <section className="panel">
          <div className="targets-grid weight-summary-grid">
            <div>
              <span>Current</span>
              <strong>
                {currentWeightEntry
                  ? formatWeightValueInUnit(currentWeightEntry.weight, currentWeightEntry.unit, displayUnit)
                  : "No entry"}
              </strong>
            </div>
            <div>
              <span>Starting</span>
              <strong>
                {startingWeightEntry
                  ? formatWeightValueInUnit(startingWeightEntry.weight, startingWeightEntry.unit, displayUnit)
                  : "No entry"}
              </strong>
            </div>
            <div>
              <span>Total change</span>
              <strong>
                {summaryChangeLabel}
              </strong>
            </div>
            <div>
              <span>Latest weigh-in</span>
              <strong>{currentWeightEntry ? formatShortDate(currentWeightEntry.date) : "No entry"}</strong>
            </div>
          </div>
        </section>

        <section className="panel weight-entry-panel" {...tapProbeProps("weight-entry-panel")}>
          <h2>Log Weight</h2>
          <div className="weight-form" {...tapProbeProps("weight-form")}>
            <label>
              Date
              <input
                type="date"
                value={weightForm.date}
                onChange={(e) => {
                  setWeightSaveError("");
                  setWeightForm({ ...weightForm, date: e.target.value });
                }}
              />
            </label>
            <label>
              Weight ({weightUnit})
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value={weightForm.weight}
                onChange={(e) => {
                  setWeightSaveError("");
                  setWeightForm({ ...weightForm, weight: e.target.value });
                }}
              />
            </label>
            <label>
              Note
              <input
                value={weightForm.note}
                placeholder="Optional"
                onChange={(e) => {
                  setWeightSaveError("");
                  setWeightForm({ ...weightForm, note: e.target.value });
                }}
              />
            </label>
            {weightSaveError && <p className="form-error">{weightSaveError}</p>}
            <button
  type="button"
  className="primary-button"
  onPointerDown={(event) => logTapProbe("weight-save-button", "pointerdown", event)}
  onTouchStart={(event) => logTapProbe("weight-save-button", "touchstart", event)}
  onClick={(event) => {
    logTapProbe("weight-save-button", "click", event);
    saveWeightEntry();
  }}
  disabled={!isWeightFormValid}
>
  {editingWeightEntryId ? "Update" : "Save"}
</button>

{editingWeightEntryId && (
  <button
    type="button"
    className="secondary-button"
    onClick={() => {
      setEditingWeightEntryId(null);
      setWeightForm({ date: today, weight: "", note: "" });
    }}
  >
    Cancel
  </button>
)}
          </div>
        </section>

        <section className="panel">
          <div className="weight-chart-header">
            <div>
              <span>Date Range</span>
              <strong>{chartRangeLabel}</strong>
            </div>
            <div>
              <span>Highest Weight</span>
              <strong>{chartEntries.length ? formatWeightValue(chartHighest, displayUnit) : "No entry"}</strong>
            </div>
            <div>
              <span>Lowest Weight</span>
              <strong>{chartEntries.length ? formatWeightValue(chartLowest, displayUnit) : "No entry"}</strong>
            </div>
            <div>
              <span>Net Change</span>
              <strong>{chartDelta === null ? "No entry" : `${chartDelta < 0 ? "Lost" : "Gained"} ${formatWeightValue(Math.abs(chartDelta), displayUnit)}`}</strong>
            </div>
            <div>
              <span>Average Weight</span>
              <strong>{chartEntries.length ? formatWeightValue(chartAverage, displayUnit) : "No entry"}</strong>
            </div>
          </div>

          <div className="weight-range-controls" role="tablist" aria-label="Weight chart range">
            {(["1M", "3M", "6M", "1Y", "All"] as WeightRange[]).map((range) => (
              <button
                key={range}
                type="button"
                className={weightRange === range ? "active" : ""}
                onClick={() => setWeightRange(range)}
                role="tab"
                aria-selected={weightRange === range}
              >
                {getWeightRangeLabel(range)}
              </button>
            ))}
          </div>

          <div className="section-heading-row">
            <h2>Trend</h2>
          </div>

          {sortedWeightEntriesOldest.length === 0 && (
            <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>
          )}

          {sortedWeightEntriesOldest.length === 1 && (
            <p className="empty-meal">Add at least two weight entries to see your trend.</p>
          )}

          {sortedWeightEntriesOldest.length >= 2 && (
            <div className="weight-chart-shell">
              <div className="weight-chart" aria-label="Weight trend graph">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img">
                  {chartYAxisPositions.map((y, index) => (
                    <line
                      key={`h-${index}`}
                      className="weight-chart-grid"
                      x1={chartLeft}
                      y1={y}
                      x2={chartWidth - chartRight}
                      y2={y}
                    />
                  ))}
                  {chartXAxisPositions.map((x, index) => (
                    <line
                      key={`v-${index}`}
                      className="weight-chart-grid"
                      x1={x}
                      y1={chartTop}
                      x2={x}
                      y2={chartHeight - chartBottom}
                    />
                  ))}
                  <line
                    className="weight-chart-axis"
                    x1={chartLeft}
                    y1={chartHeight - chartBottom}
                    x2={chartWidth - chartRight}
                    y2={chartHeight - chartBottom}
                  />
                  <line
                    className="weight-chart-axis"
                    x1={chartLeft}
                    y1={chartTop}
                    x2={chartLeft}
                    y2={chartHeight - chartBottom}
                  />
                  <polyline className="weight-chart-line" points={chartLinePoints} />
                  {chartPoints.map((point) => {
                    const tooltip = [
                      formatShortDate(point.date),
                      formatWeightValue(point.displayWeight, displayUnit),
                      point.note ? `Note: ${point.note}` : null,
                    ]
                      .filter(Boolean)
                      .join("\n");

                    return (
                      <g key={point.id}>
                        <circle
                          className="weight-chart-dot"
                          cx={point.x}
                          cy={point.y}
                          r="4"
                          tabIndex={0}
                          aria-label={tooltip}
                          onMouseEnter={() => setWeightChartPointId(point.id)}
                          onFocus={() => setWeightChartPointId(point.id)}
                          onClick={() => setWeightChartPointId(point.id)}
                        >
                          <title>{tooltip}</title>
                        </circle>
                      </g>
                    );
                  })}
                  {chartYAxisTicks.map((value, index) => (
                    <text
                      key={`y-label-${index}`}
                      className="weight-chart-label"
                      x={chartLeft - 10}
                      y={chartYAxisPositions[index] + 4}
                      textAnchor="end"
                    >
                      {getWeightTickLabel(value, chartStep, displayUnit)}
                    </text>
                  ))}
                  {[
                    { value: chartFirstDate, x: chartXAxisPositions[0], anchor: "start" as const },
                    {
                      value: chartMiddleDate,
                      x: chartXAxisPositions[1],
                      anchor: "middle" as const,
                    },
                    {
                      value: chartLastDate,
                      x: chartXAxisPositions[2],
                      anchor: "end" as const,
                    },
                  ].map((label, index) => (
                    <text
                      key={`x-label-${index}`}
                      className="weight-chart-label"
                      x={label.x}
                      y={chartHeight - 10}
                      textAnchor={label.anchor}
                    >
                      {formatShortDate(label.value)}
                    </text>
                  ))}
                </svg>
              </div>
              {selectedChartPoint && (
                <div className="weight-chart-point-card" aria-live="polite">
                  <strong>{formatShortDate(selectedChartPoint.date)}</strong>
                  <span>{formatWeightValue(selectedChartPoint.displayWeight, displayUnit)}</span>
                  {selectedChartPoint.note && <small>{selectedChartPoint.note}</small>}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Entries</h2>

          {sortedWeightEntriesNewest.length === 0 && (
            <p className="empty-meal">Add your first weigh-in to start tracking progress.</p>
          )}

          <div className="weight-entry-list">
            {sortedWeightEntriesNewest.map((entry) => {
  const chronological = sortedWeightEntriesOldest;
  const index = chronological.findIndex((item) => item.id === entry.id);
  const previous = index > 0 ? chronological[index - 1] : null;

  const entryWeight = convertWeightValue(entry.weight, entry.unit, displayUnit);
  const previousWeight = previous
    ? convertWeightValue(previous.weight, previous.unit, displayUnit)
    : null;

  const change = previousWeight === null ? null : entryWeight - previousWeight;

  return (
    <div className="weight-entry-row" key={entry.id}>
      <div className="weight-entry-info">
        <strong>{formatEntryDate(entry.date)} — {formatWeightValue(entryWeight, displayUnit)}</strong>
        {change !== null && (
          <span
            className={
              change < 0
                ? "weight-change-loss"
                : change > 0
                ? "weight-change-gain"
                : "weight-change-neutral"
            }
          >
            {change > 0 ? "+" : ""}{formatWeightValue(change, displayUnit)}
          </span>
        )}
        {entry.note && <small className="weight-entry-note">{entry.note}</small>}
      </div>

      <div className="weight-entry-actions">
        <button type="button" onClick={() => startEditWeightEntry(entry)}>Edit</button>
        <button type="button" onClick={() => setWeightEntryToDelete(entry)}>Delete</button>
      </div>
    </div>
  );
})}
          </div>
        </section>

        {weightEntryToDelete && (
          <div className="floating-overlay" role="presentation">
            <div
              className="floating-popover confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="remove-weight-title"
            >
              <h2 id="remove-weight-title">Delete weight entry?</h2>
              <p>
                {formatWeightValue(weightEntryToDelete.weight, weightEntryToDelete.unit)} from{" "}
                {formatShortDate(weightEntryToDelete.date)} will be deleted.
              </p>

              <button className="danger-button" onClick={confirmDeleteWeightEntry}>
                Delete
              </button>
              <button className="secondary-button" onClick={() => setWeightEntryToDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
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

            <div className="search-row">
              <input
                className="library-search"
                value={libraryQuery}
                placeholder={`Search ${foodLibraryTab}...`}
                onChange={(e) => setLibraryQuery(e.target.value)}
              />
              {foodLibraryTab === "custom" && (
                <button type="button" onClick={createLibraryCustomFood}>
                  Add custom
                </button>
              )}
              {foodLibraryTab === "recipes" && (
                <button type="button" onClick={createLibraryRecipe}>
                  Add recipe
                </button>
              )}
            </div>

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
                    <span>Brand: {getBrandDisplayName(food.brand)}</span>
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
                    <span>Brand: {getBrandDisplayName(food.brand)}</span>
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
            {!librarySelection && !isCreatingLibraryCustomFood && !isCreatingLibraryRecipe && (
              <p className="empty-meal">Select a food to view details.</p>
            )}

            {librarySelection && (
              <>
                <h2>{librarySelection.food.name}</h2>
                <p>{getBrandDisplayName(librarySelection.food.brand)}</p>
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
                  <span>Sugar</span>
                  <strong>{Number((librarySelection.food.sugar ?? 0).toFixed(1))}g</strong>
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

            {(isCreatingLibraryCustomFood ||
              (librarySelection?.type === "custom" && editingCustomFoodId === librarySelection.food.id)) && (
              <div className="custom-food-form library-edit-form">
                {isCreatingLibraryCustomFood && <h2>Create Custom Food</h2>}
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
                  Sugar
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={libraryCustomFoodForm.sugar}
                    onChange={(e) =>
                      setLibraryCustomFoodForm({ ...libraryCustomFoodForm, sugar: e.target.value })
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
                  <button
                    type="button"
                    onClick={isCreatingLibraryCustomFood ? saveNewLibraryCustomFood : saveLibraryCustomFood}
                  >
                    {isCreatingLibraryCustomFood ? "Create" : "Save"}
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

            {(isCreatingLibraryRecipe ||
              (librarySelection?.type === "recipe" && editingRecipeId === librarySelection.food.id)) && (
              <div className="recipe-builder library-edit-form">
                {isCreatingLibraryRecipe && <h2>Create Recipe</h2>}
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

                {recipeIngredientOptions.length > 0 && (
                  <div className="ingredient-picker">
                    {recipeIngredientOptions.map((food) => (
                      <button
                        className={pendingRecipeIngredient?.id === food.id ? "selected" : ""}
                        key={food.id}
                        type="button"
                        onClick={() => selectRecipeIngredient(food)}
                      >
                        <strong>{getFoodDisplayName(food)}</strong>
                        <span>
                          {food.calories} cal per {food.servingSize}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {isSearchingRecipeIngredients && <p className="empty-meal">Searching foods...</p>}

                {pendingRecipeIngredient && (
                  <div className="ingredient-confirm">
                    <div>
                      <strong>{getFoodDisplayName(pendingRecipeIngredient)}</strong>
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
                    <button type="button" onClick={confirmLibraryRecipeIngredient}>
                      Add ingredient
                    </button>
                    <button type="button" onClick={() => setPendingRecipeIngredient(null)}>
                      Cancel
                    </button>
                  </div>
                )}

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
                  <button
                    type="button"
                    onClick={isCreatingLibraryRecipe ? saveNewLibraryRecipe : saveLibraryRecipe}
                  >
                    {isCreatingLibraryRecipe ? "Create" : "Save"}
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
      {(() => {
        const calorieBudget = goals?.calories ?? 0;
        const exerciseCalories = 0;
        const foodCalories = totalCalories;
        const netCalories = Math.max(0, foodCalories - exerciseCalories);
        const calorieDelta = calorieBudget - netCalories;
        const calorieGaugePct = calorieBudget > 0
          ? Math.min(100, Math.round((netCalories / calorieBudget) * 100))
          : 0;
        const totalMacroGrams = dailyTotals.protein + dailyTotals.carbs + dailyTotals.fat;
        const proteinPct = totalMacroGrams > 0 ? (dailyTotals.protein / totalMacroGrams) * 100 : 0;
        const carbsPct = totalMacroGrams > 0 ? (dailyTotals.carbs / totalMacroGrams) * 100 : 0;
        const fatPct = totalMacroGrams > 0 ? (dailyTotals.fat / totalMacroGrams) * 100 : 0;
        const isDayLogged = completedDays.includes(selectedDate);

        return (
          <section className="log-screen">
            <div className="log-date-nav">
              <button type="button" onClick={() => moveSelectedDate(-1)} aria-label="Previous day">
                ‹
              </button>
              <label className="log-calendar-button" aria-label="Pick date">
                <span>📅</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => changeSelectedDate(e.target.value)}
                />
              </label>
              <strong>{formatEntryDate(selectedDate)}</strong>
              <button type="button" onClick={() => moveSelectedDate(1)} aria-label="Next day">
                ›
              </button>
              <button
                type="button"
                className="log-export-button"
                onClick={() => {
                  setExportStatus("");
                  setIsExportPanelOpen(true);
                }}
              >
                Export Day
              </button>
            </div>

            <section className="panel log-summary-card">
              <div className="log-summary-budget">
                <span>Budget</span>
                <strong>{calorieBudget > 0 ? `${calorieBudget.toLocaleString()} cal` : "Set goal"}</strong>
              </div>

              <div className="log-calorie-gauge" style={{ "--gauge-pct": `${calorieGaugePct}%` } as CSSProperties}>
                <div className="log-gauge-ring">
                  <div>
                    <span>{calorieDelta >= 0 ? "Remaining" : "Over"}</span>
                    <strong>{Math.abs(calorieDelta).toLocaleString()}</strong>
                    <small>cal</small>
                  </div>
                </div>
              </div>

              <div className="log-meal-breakdown">
                {mealCategories.map((category) => {
                  const mealTotals = getCategoryTotals(category);
                  return (
                    <button key={category} type="button" onClick={() => scrollToMeal(category)}>
                      <span>{category}</span>
                      <strong>{mealTotals.calories.toLocaleString()}</strong>
                    </button>
                  );
                })}
              </div>

              <div className="log-macro-row">
                <span><i className="macro-dot protein-dot" /> Protein <strong>{formatMacro(dailyTotals.protein)}g</strong></span>
                <span><i className="macro-dot carbs-dot" /> Carbs <strong>{formatMacro(dailyTotals.carbs)}g</strong></span>
                <span><i className="macro-dot fat-dot" /> Fat <strong>{formatMacro(dailyTotals.fat)}g</strong></span>
              </div>

              <div className="log-macro-segmented" aria-label="Macro progress">
                {totalMacroGrams > 0 ? (
                  <>
                    <span className="protein-segment" style={{ width: `${proteinPct}%` }} />
                    <span className="carbs-segment" style={{ width: `${carbsPct}%` }} />
                    <span className="fat-segment" style={{ width: `${fatPct}%` }} />
                  </>
                ) : (
                  <span className="empty-segment" />
                )}
              </div>
            </section>

            <div className="log-meal-list">
              {mealCategories.map((category) => {
                const mealItems = log.filter((item) => item.category === category);
                const mealTotals = getCategoryTotals(category);
                const isExpanded = expandedMeals[category];

                return (
                  <section
                    className="panel log-meal-card"
                    key={category}
                    ref={(element) => {
                      mealCardRefs.current[category] = element;
                    }}
                  >
                    <div className="log-meal-header">
                      <button
                        type="button"
                        className="meal-expand-button"
                        onClick={() => toggleMeal(category)}
                        aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category}`}
                      >
                        {isExpanded ? "▾" : "▸"}
                      </button>
                      <div>
                        <h3>{category}</h3>
                        <span>{mealTotals.calories.toLocaleString()} cal</span>
                      </div>
                      <button
                        type="button"
                        className="meal-menu-button"
                        aria-label={`${category} menu`}
                        onClick={() => setMealMenuCategory(mealMenuCategory === category ? null : category)}
                      >
                        ⋯
                      </button>
                      {mealMenuCategory === category && (
                        <div className="meal-settings-menu">
                          <button type="button" onClick={() => openSaveMealAsRecipe(category)} disabled={mealItems.length === 0}>
                            Save Meal as Recipe
                          </button>
                          <button
                            type="button"
                            className="danger-menu-item"
                            onClick={() => {
                              setMealMenuCategory(null);
                              setMealToDelete(category);
                            }}
                            disabled={mealItems.length === 0}
                          >
                            Delete Entire Meal
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="log-meal-macros">
                      <span>Fat {formatMacro(mealTotals.fat)}g</span>
                      <span>Carbs {formatMacro(mealTotals.carbs)}g</span>
                      <span>Protein {formatMacro(mealTotals.protein)}g</span>
                    </div>

                    {isExpanded && (
                      <div className="log-food-list">
                        {mealItems.length === 0 && (
                          <p className="empty-meal">No foods logged.</p>
                        )}

                        {mealItems.map((item) => (
                          <div className="log-food-row" key={item.logId}>
                            <div className="log-food-icon" aria-hidden="true">
                              {item.name.trim().charAt(0).toUpperCase() || "•"}
                            </div>
                            <div className="log-food-main">
                              <strong>{getFoodDisplayName(item)}</strong>
                              <span>{item.servingSize} × {item.quantity}</span>
                            </div>
                            <div className="log-food-calories">
                              <strong>{getItemCalories(item)}</strong>
                              <span>cal</span>
                            </div>
                            <button type="button" className="log-food-edit" onClick={() => openEditFoodItem(item)} aria-label={`Edit ${getFoodDisplayName(item)}`}>
                              ✎
                            </button>
                            <button type="button" className="log-food-remove" onClick={() => setItemToRemove(item)}>
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="log-meal-actions">
                      <button
                        className="log-add-food-button"
                        type="button"
                        onPointerDown={(event) => logTapProbe(`open-add-food-${category}`, "pointerdown", event)}
                        onTouchStart={(event) => logTapProbe(`open-add-food-${category}`, "touchstart", event)}
                        onClick={(event) => {
                          logTapProbe(`open-add-food-${category}`, "click", event);
                          openAddFood(category);
                        }}
                      >
                        Add Food
                      </button>
                    </div>
                  </section>
                );
              })}
            </div>

            <div className="finished-logging-row">
              <span className="finish-toggle-label">Finish Logging</span>
              <div className={`finish-toggle${isDayLogged ? " logged" : ""}`} role="switch" aria-checked={isDayLogged} aria-label="Finish logging">
                <span className="finish-toggle-indicator" />
                <button type="button" aria-label="Mark day unfinished" onClick={reopenDayLogging} />
                <button type="button" aria-label="Finish logging" onClick={markDayComplete} />
              </div>
            </div>
          </section>
        );
      })()}

      {pendingCategory && (
        <div className="modal-backdrop" role="presentation" {...tapProbeProps("add-food-modal-backdrop")}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="meal-category-title" {...tapProbeProps("add-food-modal")}>
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
                        <strong>{getFoodDisplayName(food)}</strong>
                        <span className="food-card-meta">
                          <span>Brand: {getBrandDisplayName(food.brand)}</span>
                        </span>
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
                    <span>Brand: {getBrandDisplayName(food.brand)}</span>
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
                  <button
                    type="button"
                    onPointerDown={(event) => logTapProbe("open-custom-food-form", "pointerdown", event)}
                    onTouchStart={(event) => logTapProbe("open-custom-food-form", "touchstart", event)}
                    onClick={(event) => {
                      logTapProbe("open-custom-food-form", "click", event);
                      openCustomFoodForm();
                    }}
                  >
                    Add custom
                  </button>
                </div>

                {isCustomFormOpen && (
                  <div className="custom-food-form" {...tapProbeProps("custom-food-form")}>
                    <div className="scan-food-panel">
                      <label className={`scan-file-label${isScanningCustomFood ? " disabled" : ""}`}>
                        <input
                          ref={customFoodScanInputRef}
                          className="scan-file-input"
                          type="file"
                          accept="image/*"
                          capture="environment"
                          disabled={isScanningCustomFood}
                          onClick={(e) => {
                            e.currentTarget.value = "";
                          }}
                          onChange={(e) => scanCustomFoodLabel(e.target.files?.[0])}
                        />
                        {isScanningCustomFood ? "Scanning label..." : "Scan Nutrition Label"}
                      </label>
                      {isScanningCustomFood && (
                        <p className="scan-status">Reading the nutrition label. This can take a moment.</p>
                      )}
                      {customFoodOcrError && <p className="form-error">{customFoodOcrError}</p>}
                      {customFoodOcrText && (
                        <details className="ocr-debug">
                          <summary>OCR raw text</summary>
                          <pre>{customFoodOcrText}</pre>
                        </details>
                      )}
                    </div>
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
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={customFoodForm.calories}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, calories: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Protein
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={customFoodForm.protein}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, protein: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Carbs
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={customFoodForm.carbs}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, carbs: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fat
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={customFoodForm.fat}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, fat: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Fiber
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={customFoodForm.fiber}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, fiber: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Sugar
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
                        value={customFoodForm.sugar}
                        onChange={(e) =>
                          setCustomFoodForm({ ...customFoodForm, sugar: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Sodium
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*[.]?[0-9]*"
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

                    <div className="form-actions" {...tapProbeProps("custom-food-form-actions")}>
                      {customFoodSaveError && <p className="form-error">{customFoodSaveError}</p>}
                      <button
                        type="button"
                        onPointerDown={(event) => logTapProbe("custom-food-save-button", "pointerdown", event)}
                        onTouchStart={(event) => logTapProbe("custom-food-save-button", "touchstart", event)}
                        onClick={(event) => {
                          logTapProbe("custom-food-save-button", "click", event);
                          createCustomFood();
                        }}
                      >
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
                        <span>Brand: {getBrandDisplayName(food.brand)}</span>
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

                        {recipeIngredientOptions.map((food) => {
                          return (
                            <button
                              className={pendingRecipeIngredient?.id === food.id ? "selected" : ""}
                              key={food.id}
                              type="button"
                              onClick={() => selectRecipeIngredient(food)}
                            >
                              <strong>{getFoodDisplayName(food)}</strong>
                              <span className="food-card-meta">
                                <span>Brand: {getBrandDisplayName(food.brand)}</span>
                              </span>
                              <span>
                                {food.calories} cal per {food.servingSize}
                              </span>
                            </button>
                          );
                        })}
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
                <button className="secondary-button" onClick={closeAddFood}>
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {pendingCategory && selectedFood && !isCustomFormOpen && !isRecipeFormOpen && (
        <div className="floating-overlay serving-overlay" role="presentation">
          <div className="floating-popover serving-popover" role="dialog" aria-modal="true" aria-labelledby="serving-popup-title">
            <h2 id="serving-popup-title">{getFoodDisplayName(selectedFood)}</h2>
            {isLoadingDetail && <p className="scan-status">Loading portions...</p>}
            {detailError && <p className="modal-error">{detailError}</p>}

            <p className="serving-basis-text">
              Based on {measuredServingBasis ? `${measuredServingBasis.amount}${measuredServingBasis.unit}` : selectedFood.servingSize}
            </p>

            {allowedAmountUnits.length > 1 && (
              <div className="serving-unit-tabs" role="group" aria-label="Serving unit">
                {allowedAmountUnits.map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    className={amountUnit === unit ? "active" : ""}
                    onClick={() => setAmountUnit(unit)}
                  >
                    {unit === "serving" ? "Serving" : unit}
                  </button>
                ))}
              </div>
            )}

            {amountUnit === "serving" && portionOptions.length > 0 && (
              <label className="floating-field">
                Portion
                <select value={selectedPortionValue} onChange={(e) => setSelectedPortionValue(e.target.value)}>
                  {portionOptions.map((portion) => (
                    <option key={portion.value} value={portion.value}>
                      {portion.label} ({portion.gramWeight}g)
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="floating-field">
              {amountUnit === "serving" ? "Servings" : `Amount (${allowedAmountUnits[0]})`}
              <input
                type="text"
                inputMode="decimal"
                value={amountUnit === "serving" ? quantity : portionAmount}
                onChange={(e) =>
                  amountUnit === "serving"
                    ? setQuantity(e.target.value)
                    : setPortionAmount(e.target.value)
                }
              />
            </label>

            {selectedPortionCalories !== null && (
              <p className="modal-hint">
                {selectedPortionCalories.toLocaleString()} cal for this amount
              </p>
            )}

            <div className="floating-actions">
              <button className="primary-button" type="button" onClick={addSelectedFood} disabled={!canAddSelectedFood}>
                Add Food
              </button>
              <button className="secondary-button" type="button" onClick={() => setSelectedFood(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportPanelOpen && (
        <div className="floating-overlay" role="presentation">
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="export-day-title">
            <h2 id="export-day-title">Export Day</h2>
            <p>Creates food-log-{selectedDate}.json for the selected day only.</p>
            {!import.meta.env.VITE_GOOGLE_CLIENT_ID && (
              <label className="floating-field">
                Google OAuth Client ID
                <input
                  value={googleDriveClientId}
                  placeholder="123...apps.googleusercontent.com"
                  disabled={isUploadingToDrive}
                  onChange={(e) => setGoogleDriveClientId(e.target.value)}
                />
              </label>
            )}
            {exportStatus && <p className="scan-status">{exportStatus}</p>}
            {exportDriveLink && (
              <a className="drive-export-link" href={exportDriveLink} target="_blank" rel="noreferrer">
                Open in Google Drive
              </a>
            )}
            <div className="floating-actions">
              <button type="button" className="primary-button" onClick={downloadDayExport} disabled={isUploadingToDrive}>
                Download JSON
              </button>
              <button type="button" onClick={uploadDayExportToDrive} disabled={isUploadingToDrive}>
                {isUploadingToDrive ? "Uploading..." : "Upload Drive"}
              </button>
            </div>
            <button type="button" onClick={shareDayExport} disabled={isUploadingToDrive}>
              Share Sheet
            </button>
            <button type="button" className="secondary-button" onClick={() => setIsExportPanelOpen(false)} disabled={isUploadingToDrive}>
              Close
            </button>
          </div>
        </div>
      )}

      {mealToSaveAsRecipe && (
        <div className="floating-overlay" role="presentation">
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="save-meal-title">
            <h2 id="save-meal-title">Save meal as recipe</h2>
            <label className="floating-field">
              Recipe name
              <input value={mealRecipeName} onChange={(e) => setMealRecipeName(e.target.value)} />
            </label>
            <div className="floating-actions">
              <button type="button" onClick={saveMealAsRecipe} disabled={!mealRecipeName.trim()}>
                Save
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setMealToSaveAsRecipe(null);
                  setMealRecipeName("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {mealToDelete && (
        <div className="floating-overlay" role="presentation">
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-meal-title">
            <h2 id="delete-meal-title">Delete entire meal?</h2>
            <p>All foods in {mealToDelete} will be removed.</p>
            <div className="floating-actions">
              <button type="button" className="danger-button" onClick={confirmDeleteMeal}>
                Delete Meal
              </button>
              <button type="button" className="secondary-button" onClick={() => setMealToDelete(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToEdit && (
        <div className="floating-overlay" role="presentation">
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="edit-food-title">
            <h2 id="edit-food-title">Edit food</h2>
            <p>{getFoodDisplayName(itemToEdit)}</p>
            <label className="floating-field">
              Quantity
              <input
                type="text"
                inputMode="decimal"
                value={editItemQuantity}
                onChange={(e) => setEditItemQuantity(e.target.value)}
              />
            </label>
            <label className="floating-field">
              Serving
              <input value={editItemServingSize} onChange={(e) => setEditItemServingSize(e.target.value)} />
            </label>
            <div className="floating-actions">
              <button type="button" className="primary-button" onClick={saveEditedFoodItem}>
                Save
              </button>
              <button type="button" className="secondary-button" onClick={() => setItemToEdit(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {itemToRemove && (
        <div className="floating-overlay" role="presentation">
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="remove-food-title">
            <h2 id="remove-food-title">Remove food?</h2>
            <p>
              {getFoodDisplayName(itemToRemove)} x {itemToRemove.quantity} will be removed from{" "}
              {itemToRemove.category}.
            </p>

            <div className="floating-actions">
              <button className="danger-button" onClick={confirmRemoveFood}>
                Remove
              </button>
              <button className="secondary-button" onClick={() => setItemToRemove(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {bottomNav}
    </main>
  );
}

export default App;
