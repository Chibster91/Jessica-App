type Food = {
  id: number;
  name: string;
  brand: string | null;
  category?: string | null;
  dataType?: string | null;
  source?: string;
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

type AppView = "home" | "day" | "library" | "profile" | "weight" | "egg-oracle";

type FoodLibraryTab = "recent" | "custom" | "recipes";

type Sex = "female" | "male";

type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

type GoalType = "lose" | "maintain" | "gain";

type GoalRate = "mild" | "moderate" | "aggressive";

type ProfileActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
type ProfileUnits = "imperial" | "metric";
type MacroMode = "percentages" | "grams" | "none";
type MacroPreset = "balanced" | "high_protein" | "custom";

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

type Profile = {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activityLevel: ProfileActivityLevel;
  goal: GoalType;
  weeklyRateKg: number;
  calculatedCalories: number;
  manualCalorieOverride: number | null;
  useManualCalories: boolean;
  macroMode: MacroMode;
  macros: {
    proteinPct: number;
    carbPct: number;
    fatPct: number;
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
  };
  units: ProfileUnits;
  startingWeightKg: number;
  profileCreatedAt: string;
  profileUpdatedAt: string;
};

type ProfileForm = {
  name: string;
  units: ProfileUnits;
  age: string;
  sex: Sex;
  heightCm: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  goalWeight: string;
  activityLevel: ProfileActivityLevel;
  goal: GoalType;
  weeklyRateKg: string;
  useManualCalories: boolean;
  manualCalorieOverride: string;
  macroMode: MacroMode;
  macroPreset: MacroPreset;
  proteinPct: string;
  carbPct: string;
  fatPct: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
};

type ProfileCalculation = {
  bmr: number;
  tdee: number;
  goalAdjustment: number;
  calculatedCalories: number;
  activeCalories: number;
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

type FoodLogImportDraft = {
  id: string;
  date: string;
  meal: string;
  name: string;
  serving: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
  source: string;
};

type FoodLogImportResult =
  | { ok: true; items: FoodLogImportDraft[] }
  | { ok: false; errors: string[] };

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

type GoogleDriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
};

type GoogleDriveFileListResponse = {
  files?: GoogleDriveFile[];
};

const mealCategories = ["Breakfast", "Lunch", "Dinner", "Snacks"];
const poundsPerKilogram = 2.2046226218;
const debugLogKey = "jessicaDebugLog";
const googleDriveClientIdKey = "googleDriveClientId";
const googleDriveScope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";
const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";
const iconBaseUrl = `${import.meta.env.BASE_URL}Icons/`;

const foodIconRules: [string, string][] = [
  ["apple", "apple.svg"],
  ["avocado", "avocado.svg"],
  ["bacon", "bacon.svg"],
  ["banana", "banana.svg"],
  ["blueberry", "blueberries.svg"],
  ["blueberries", "blueberries.svg"],
  ["broccoli", "broccoli.svg"],
  ["cabbage", "cabbage.svg"],
  ["carrot", "carrot.svg"],
  ["cherry", "cherry.svg"],
  ["cherries", "cherry.svg"],
  ["chicken", "chicken-leg.svg"],
  ["coconut", "coconut.svg"],
  ["corn", "corn.svg"],
  ["cucumber", "cucumber.svg"],
  ["fish", "fish.svg"],
  ["garlic", "garlic.svg"],
  ["grape", "grapes.svg"],
  ["grapes", "grapes.svg"],
  ["kiwi", "kiwi.svg"],
  ["kale", "lettuce.svg"],
  ["lemon", "lemon.svg"],
  ["lettuce", "lettuce.svg"],
  ["lime", "lime.svg"],
  ["mango", "mango.svg"],
  ["mushroom", "mushroom.svg"],
  ["onion", "onion.svg"],
  ["orange", "orange.svg"],
  ["peach", "peach.svg"],
  ["pear", "pear.svg"],
  ["pineapple", "pineapple.svg"],
  ["potato", "potato.svg"],
  ["raspberry", "raspberry.svg"],
  ["sausage", "sausage.svg"],
  ["shrimp", "shrimp.svg"],
  ["oyster", "shrimp.svg"],
  ["seafood", "shrimp.svg"],
  ["strawberry", "strawberry.svg"],
  ["tomato", "tomato.svg"],
  ["watermelon", "watermelon.svg"],
  ["bread", "bread.svg"],
  ["toast", "bread.svg"],
  ["bun", "bread.svg"],
  ["roll", "bread.svg"],
  ["bagel", "bread.svg"],
  ["egg", "egg.svg"],
  ["eggs", "egg.svg"],
  ["milk", "milk.svg"],
  ["cheese", "cheese.svg"],
  ["yogurt", "yogurt.svg"],
  ["yoghurt", "yogurt.svg"],
  ["dairy", "dairy.svg"],
  ["dessert", "dessert.svg"],
  ["cake", "dessert.svg"],
  ["cookie", "dessert.svg"],
  ["ice cream", "dessert.svg"],
  ["brownie", "dessert.svg"],
  ["oil", "oil.svg"],
  ["butter", "oil.svg"],
  ["mayo", "oil.svg"],
  ["mayonnaise", "oil.svg"],
  ["ranch", "oil.svg"],
  ["sauce", "oil.svg"],
  ["dressing", "oil.svg"],
  ["drink", "drink.svg"],
  ["coffee", "drink.svg"],
  ["tea", "drink.svg"],
  ["juice", "drink.svg"],
  ["soda", "drink.svg"],
  ["water", "drink.svg"],
  ["vegetable", "Vegetable.svg"],
  ["vegetables", "Vegetable.svg"],
  ["veggie", "Vegetable.svg"],
  ["veggies", "Vegetable.svg"],
  ["fruit", "generic-fruit.svg"],
  ["meat", "generic-meat.svg"],
  ["meal", "Meal.svg"],
];

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

const profileActivityMultipliers: Record<ProfileActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

const profileActivityLabels: Record<ProfileActivityLevel, { title: string; detail: string }> = {
  sedentary: { title: "Sedentary", detail: "Little or no exercise, desk job" },
  light: { title: "Lightly Active", detail: "Light exercise 1-3 days/week" },
  moderate: { title: "Moderately Active", detail: "Moderate exercise 3-5 days/week" },
  active: { title: "Active", detail: "Hard exercise 6-7 days/week" },
  very_active: { title: "Very Active", detail: "Physical job or twice-daily training" },
};

const profileActivityOptions = Object.keys(profileActivityLabels) as ProfileActivityLevel[];
const profilePaceOptions = [
  { label: "Maintain", goal: "maintain" as GoalType, weeklyRateKg: 0 },
  { label: "Lose 0.5 lb/week", goal: "lose" as GoalType, weeklyRateKg: 0.5 / poundsPerKilogram },
  { label: "Lose 1 lb/week", goal: "lose" as GoalType, weeklyRateKg: 1 / poundsPerKilogram },
  { label: "Lose 1.5 lb/week", goal: "lose" as GoalType, weeklyRateKg: 1.5 / poundsPerKilogram },
] as const;
const profileWizardSteps = [
  "Basics",
  "Body",
  "Activity",
  "Plan",
  "Macros",
] as const;
const macroPresets: Record<Exclude<MacroPreset, "custom">, { label: string; proteinPct: string; carbPct: string; fatPct: string }> = {
  balanced: { label: "Balanced", proteinPct: "30", carbPct: "40", fatPct: "30" },
  high_protein: { label: "High protein", proteinPct: "40", carbPct: "30", fatPct: "30" },
};
const maxHeightInches = 108;
const maxHeightCm = maxHeightInches * 2.54;
const minProfileHeightCm = 100;
const maxProfileHeightCm = 250;
const minProfileWeightKg = 30;
const maxProfileWeightKg = 300;

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

type MealCategory = string;

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesFoodIconKeyword(text: string, keyword: string) {
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}([^a-z0-9]|$)`, "i").test(text);
}

function getFoodIconUrl(food: Pick<Food, "name" | "brand" | "category" | "dataType">) {
  const searchableText = [food.name, food.brand, food.category, food.dataType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const match = foodIconRules.find(([keyword]) => matchesFoodIconKeyword(searchableText, keyword));

  return `${iconBaseUrl}${match?.[1] ?? "Meal.svg"}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function readOptionalNumberField(source: Record<string, unknown>, keys: string[]) {
  const value = readStringField(source, keys);
  return value ? value : "0";
}

function isValidLogDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function validateImportDraft(item: FoodLogImportDraft, index: number) {
  const errors: string[] = [];
  const row = `Item ${index + 1}`;
  const calories = parseDecimalInput(item.calories);
  const protein = parseDecimalInput(item.protein || "0");
  const carbs = parseDecimalInput(item.carbs || "0");
  const fat = parseDecimalInput(item.fat || "0");

  if (!isValidLogDate(item.date)) errors.push(`${row}: date must be YYYY-MM-DD.`);
  if (!item.meal.trim()) errors.push(`${row}: meal is required.`);
  if (!item.name.trim()) errors.push(`${row}: name is required.`);
  if (!item.serving.trim()) errors.push(`${row}: serving is required.`);
  if (!Number.isFinite(calories) || calories < 0) errors.push(`${row}: calories must be a non-negative number.`);
  if (![protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0)) {
    errors.push(`${row}: protein, carbs, and fat must be non-negative numbers when provided.`);
  }

  return errors;
}

function buildImportDraft(date: string, meal: string, item: unknown): FoodLogImportDraft | null {
  if (!isRecord(item)) return null;

  const macros = isRecord(item.macros) ? item.macros : {};
  const serving = readStringField(item, ["serving", "servingSize", "portion"]);

  return {
    id: createClientId(),
    date,
    meal,
    name: readStringField(item, ["name", "food", "foodName"]),
    serving,
    calories: readStringField(item, ["calories", "kcal"]),
    protein: readOptionalNumberField({ ...macros, ...item }, ["protein"]),
    carbs: readOptionalNumberField({ ...macros, ...item }, ["carbs", "carbohydrates"]),
    fat: readOptionalNumberField({ ...macros, ...item }, ["fat"]),
    notes: readStringField(item, ["notes", "note"]),
    source: readStringField(item, ["source"]),
  };
}

function parseFoodLogImportJson(json: unknown): FoodLogImportResult {
  if (!isRecord(json)) {
    return { ok: false, errors: ["Import file must be a JSON object."] };
  }

  const date = readStringField(json, ["date"]);
  const items: FoodLogImportDraft[] = [];
  const errors: string[] = [];

  if (!date) {
    errors.push("Top-level date is required.");
  } else if (!isValidLogDate(date)) {
    errors.push("Top-level date must be YYYY-MM-DD.");
  }

  if (Array.isArray(json.meals)) {
    json.meals.forEach((mealValue, mealIndex) => {
      if (!isRecord(mealValue)) {
        errors.push(`Meal ${mealIndex + 1}: meal must be an object.`);
        return;
      }

      const mealName = readStringField(mealValue, ["name", "meal", "mealName"]);
      const mealItems = Array.isArray(mealValue.items)
        ? mealValue.items
        : Array.isArray(mealValue.foods)
          ? mealValue.foods
          : null;

      if (!mealName) errors.push(`Meal ${mealIndex + 1}: meal name is required.`);
      if (!mealItems) {
        errors.push(`Meal ${mealIndex + 1}: items must be an array.`);
        return;
      }

      mealItems.forEach((food, foodIndex) => {
        const draft = buildImportDraft(date, mealName, food);
        if (draft) items.push(draft);
        else errors.push(`Meal ${mealIndex + 1}, item ${foodIndex + 1}: item must be an object.`);
      });
    });
  } else {
    const mealName = readStringField(json, ["meal", "mealName"]);
    if (!mealName) errors.push("Meal name is required.");
    if (!Array.isArray(json.items)) {
      errors.push("Items must be an array.");
    } else {
      json.items.forEach((food, index) => {
        const draft = buildImportDraft(date, mealName, food);
        if (draft) items.push(draft);
        else errors.push(`Item ${index + 1}: item must be an object.`);
      });
    }
  }

  if (items.length === 0) errors.push("Import file must include at least one item.");
  items.forEach((item, index) => errors.push(...validateImportDraft(item, index)));

  return errors.length > 0 ? { ok: false, errors } : { ok: true, items };
}

function normalizeMealName(meal: string) {
  return meal.trim().replace(/\s+/g, " ");
}

function getMealCategoriesForLog(items: LogItem[]) {
  const importedMeals = items.map((item) => item.category).filter((category) => !mealCategories.includes(category));
  return [...mealCategories, ...Array.from(new Set(importedMeals))];
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

function getSavedProfile(): Profile | null {
  try {
    const saved = localStorage.getItem("profile");
    return saved ? (JSON.parse(saved) as Profile) : null;
  } catch (error) {
    appendDebugLog("storage-read-failed", {
      key: "profile",
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function toProfileActivityLevel(level: ActivityLevel | ProfileActivityLevel | undefined): ProfileActivityLevel {
  if (level === "veryActive") return "very_active";
  if (level === "sedentary" || level === "light" || level === "moderate" || level === "active" || level === "very_active") {
    return level;
  }
  return "moderate";
}

function toCalculatorActivityLevel(level: ProfileActivityLevel): ActivityLevel {
  return level === "very_active" ? "veryActive" : level;
}

function kgToLb(value: number) {
  return value * poundsPerKilogram;
}

function lbToKg(value: number) {
  return value / poundsPerKilogram;
}

function cmToTotalInches(value: number) {
  return value / 2.54;
}

function formatProfileNumber(value: number, decimals = 1) {
  if (!Number.isFinite(value)) return "";
  const rounded = Number(value.toFixed(decimals));
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function profileToForm(profile: Profile): ProfileForm {
  const totalInches = cmToTotalInches(profile.heightCm);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;

  return {
    name: profile.name,
    units: profile.units,
    age: String(profile.age),
    sex: profile.sex,
    heightCm: formatProfileNumber(profile.heightCm, 1),
    heightFeet: String(feet),
    heightInches: formatProfileNumber(inches, 1),
    weight: profile.units === "metric"
      ? formatProfileNumber(profile.weightKg, 1)
      : formatProfileNumber(kgToLb(profile.weightKg), 1),
    goalWeight: profile.goalWeightKg
      ? profile.units === "metric"
        ? formatProfileNumber(profile.goalWeightKg, 1)
        : formatProfileNumber(kgToLb(profile.goalWeightKg), 1)
      : "",
    activityLevel: toProfileActivityLevel(profile.activityLevel),
    goal: profile.goal,
    weeklyRateKg: String(profile.weeklyRateKg || 0.5),
    useManualCalories: profile.useManualCalories,
    manualCalorieOverride: profile.manualCalorieOverride ? String(profile.manualCalorieOverride) : "",
    macroMode: profile.macroMode,
    macroPreset: "custom",
    proteinPct: String(profile.macros.proteinPct ?? 30),
    carbPct: String(profile.macros.carbPct ?? 40),
    fatPct: String(profile.macros.fatPct ?? 30),
    proteinGrams: String(profile.macros.proteinGrams ?? ""),
    carbGrams: String(profile.macros.carbGrams ?? ""),
    fatGrams: String(profile.macros.fatGrams ?? ""),
  };
}

function profileFormFromLegacyGoals(goals: Goals | null): ProfileForm {
  const inputs = calculatorInputsToForm(goals);
  const heightCm = getHeightCm(inputs);
  const weight = Number(inputs.weight);
  const weightKg =
    Number.isFinite(weight) && weight > 0
      ? inputs.weightUnit === "kg"
        ? weight
        : lbToKg(weight)
      : 0;
  const units: ProfileUnits = inputs.weightUnit === "kg" || inputs.heightUnit === "cm" ? "metric" : "imperial";
  const totalInches = heightCm ? cmToTotalInches(heightCm) : 0;
  const feet = totalInches ? Math.floor(totalInches / 12) : 5;
  const inches = totalInches ? totalInches - feet * 12 : 4;
  const goalWeightKg = goals?.goalWeight
    ? goals.goalWeightUnit
      ? convertWeightValue(goals.goalWeight, goals.goalWeightUnit, "kg")
      : units === "metric"
        ? goals.goalWeight
        : lbToKg(goals.goalWeight)
    : null;

  return {
    name: "",
    units,
    age: inputs.age,
    sex: inputs.sex,
    heightCm: heightCm ? formatProfileNumber(heightCm, 1) : "",
    heightFeet: String(feet),
    heightInches: formatProfileNumber(inches, 1),
    weight: weightKg
      ? units === "metric"
        ? formatProfileNumber(weightKg, 1)
        : formatProfileNumber(kgToLb(weightKg), 1)
      : "",
    goalWeight: goals?.goalWeight
      ? units === "metric"
        ? formatProfileNumber(goalWeightKg ?? 0, 1)
        : formatProfileNumber(kgToLb(goalWeightKg ?? 0), 1)
      : "",
    activityLevel: toProfileActivityLevel(inputs.activityLevel),
    goal: inputs.goal,
    weeklyRateKg: inputs.goal === "maintain" ? "0.5" : inputs.rate === "mild" ? "0.25" : inputs.rate === "aggressive" ? "0.75" : "0.5",
    useManualCalories: false,
    manualCalorieOverride: goals ? String(goals.calories) : "",
    macroMode: goals ? "grams" : "none",
    macroPreset: "custom",
    proteinPct: "30",
    carbPct: "40",
    fatPct: "30",
    proteinGrams: goals ? String(goals.protein) : "",
    carbGrams: goals ? String(goals.carbs) : "",
    fatGrams: goals ? String(goals.fat) : "",
  };
}

function getProfileHeightCm(form: ProfileForm) {
  if (form.units === "metric") {
    const height = parseDecimalInput(form.heightCm);
    return Number.isFinite(height) ? height : null;
  }

  const feet = parseDecimalInput(form.heightFeet || "0");
  const inches = parseDecimalInput(form.heightInches || "0");
  if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null;

  return (feet * 12 + inches) * 2.54;
}

function getProfileWeightKg(form: ProfileForm) {
  const weight = parseDecimalInput(form.weight);
  if (!Number.isFinite(weight)) return null;
  return form.units === "metric" ? weight : lbToKg(weight);
}

function getProfileGoalWeightKg(form: ProfileForm) {
  const goalWeight = form.goalWeight ?? "";
  if (!goalWeight.trim()) return null;
  const weight = parseDecimalInput(goalWeight);
  if (!Number.isFinite(weight)) return null;
  return form.units === "metric" ? weight : lbToKg(weight);
}

function calculateProfile(form: ProfileForm): ProfileCalculation | null {
  const age = parseDecimalInput(form.age);
  const heightCm = getProfileHeightCm(form);
  const weightKg = getProfileWeightKg(form);

  if (
    !Number.isInteger(age) ||
    age < 13 ||
    age > 100 ||
    heightCm === null ||
    heightCm < minProfileHeightCm ||
    heightCm > maxProfileHeightCm ||
    weightKg === null ||
    weightKg < minProfileWeightKg ||
    weightKg > maxProfileWeightKg
  ) {
    return null;
  }

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (form.sex === "female" ? -161 : 5);
  const tdee = bmr * profileActivityMultipliers[form.activityLevel];
  const weeklyRateKg = Number(form.weeklyRateKg) || 0;
  const rawAdjustment = form.goal === "maintain" ? 0 : weeklyRateKg * 1100 * (form.goal === "lose" ? -1 : 1);
  const goalAdjustment = form.goal === "lose" ? Math.max(rawAdjustment, -1000) : rawAdjustment;
  const calculatedCalories = Math.round(tdee + goalAdjustment);
  const manualCalories = parseDecimalInput(form.manualCalorieOverride);
  const activeCalories =
    form.useManualCalories && Number.isFinite(manualCalories) && manualCalories > 0
      ? Math.round(manualCalories)
      : calculatedCalories;

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goalAdjustment: Math.round(goalAdjustment),
    calculatedCalories,
    activeCalories,
  };
}

function getProfileValidationErrors(form: ProfileForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  const age = parseDecimalInput(form.age);
  const heightCm = getProfileHeightCm(form);
  const weightKg = getProfileWeightKg(form);
  const goalWeightKg = getProfileGoalWeightKg(form);
  const manualCalories = parseDecimalInput(form.manualCalorieOverride);
  const proteinPct = parseDecimalInput(form.proteinPct);
  const carbPct = parseDecimalInput(form.carbPct);
  const fatPct = parseDecimalInput(form.fatPct);
  const proteinGrams = parseDecimalInput(form.proteinGrams || "0");
  const carbGrams = parseDecimalInput(form.carbGrams || "0");
  const fatGrams = parseDecimalInput(form.fatGrams || "0");

  if (name && (name.length < 2 || name.length > 40)) errors.name = "Display name must be 2-40 characters.";
  if (!form.age) errors.age = "Age is required.";
  else if (!Number.isInteger(age) || age < 13 || age > 100) errors.age = "Age must be 13-100.";
  if (heightCm === null) errors.height = "Height is required.";
  else if (heightCm < minProfileHeightCm || heightCm > maxProfileHeightCm) errors.height = "Height must be 100-250 cm.";
  if (!form.weight) errors.weight = "Current weight is required.";
  else if (weightKg === null || weightKg < minProfileWeightKg || weightKg > maxProfileWeightKg) {
    errors.weight = "Weight must be 30-300 kg.";
  }
  if (form.goalWeight && (goalWeightKg === null || goalWeightKg < minProfileWeightKg || goalWeightKg > maxProfileWeightKg)) {
    errors.goalWeight = "Goal weight must be 30-300 kg.";
  }
  if (form.useManualCalories && (!Number.isFinite(manualCalories) || manualCalories <= 0)) {
    errors.manualCalories = "Manual calorie goal is required.";
  }
  if (form.macroMode === "percentages") {
    if (![proteinPct, carbPct, fatPct].every((value) => Number.isInteger(value) && value >= 0 && value <= 100)) {
      errors.macros = "Macro percentages must be whole numbers from 0-100.";
    } else if (proteinPct + carbPct + fatPct !== 100) {
      errors.macros = "Macro percentages must total exactly 100%.";
    }
  }
  if (form.macroMode === "grams" && ![proteinGrams, carbGrams, fatGrams].every((value) => Number.isFinite(value) && value >= 0)) {
    errors.macros = "Macro grams must be 0 or higher.";
  }

  return errors;
}

function profileFormToProfile(form: ProfileForm, existingProfile: Profile | null): Profile | null {
  const calculation = calculateProfile(form);
  const age = parseDecimalInput(form.age);
  const heightCm = getProfileHeightCm(form);
  const weightKg = getProfileWeightKg(form);
  const goalWeightKg = getProfileGoalWeightKg(form);

  if (!calculation || heightCm === null || weightKg === null || !Number.isInteger(age)) return null;

  const now = new Date().toISOString();
  const manualCalories = parseDecimalInput(form.manualCalorieOverride);

  return {
    name: form.name.trim(),
    age,
    sex: form.sex,
    heightCm,
    weightKg,
    ...(goalWeightKg !== null ? { goalWeightKg } : {}),
    activityLevel: form.activityLevel,
    goal: form.goal,
    weeklyRateKg: form.goal === "maintain" ? 0 : Number(form.weeklyRateKg),
    calculatedCalories: calculation.calculatedCalories,
    manualCalorieOverride:
      form.useManualCalories && Number.isFinite(manualCalories) && manualCalories > 0
        ? Math.round(manualCalories)
        : null,
    useManualCalories: form.useManualCalories,
    macroMode: form.macroMode,
    macros: {
      proteinPct: Math.round(parseDecimalInput(form.proteinPct || "30")),
      carbPct: Math.round(parseDecimalInput(form.carbPct || "40")),
      fatPct: Math.round(parseDecimalInput(form.fatPct || "30")),
      proteinGrams: Math.round(parseDecimalInput(form.proteinGrams || "0")),
      carbGrams: Math.round(parseDecimalInput(form.carbGrams || "0")),
      fatGrams: Math.round(parseDecimalInput(form.fatGrams || "0")),
    },
    units: form.units,
    startingWeightKg: existingProfile?.startingWeightKg ?? weightKg,
    profileCreatedAt: existingProfile?.profileCreatedAt ?? now,
    profileUpdatedAt: now,
  };
}

function profileToGoals(profile: Profile): Goals {
  const activeCalories = profile.useManualCalories && profile.manualCalorieOverride
    ? profile.manualCalorieOverride
    : profile.calculatedCalories;
  const macroGoals =
    profile.macroMode === "grams"
      ? {
          calories: activeCalories,
          protein: profile.macros.proteinGrams ?? 0,
          carbs: profile.macros.carbGrams ?? 0,
          fat: profile.macros.fatGrams ?? 0,
        }
      : profile.macroMode === "percentages"
        ? {
            calories: activeCalories,
            protein: Math.round((activeCalories * profile.macros.proteinPct) / 100 / 4),
            carbs: Math.round((activeCalories * profile.macros.carbPct) / 100 / 4),
            fat: Math.round((activeCalories * profile.macros.fatPct) / 100 / 9),
          }
        : getMacroGoals(activeCalories);

  return {
    calories: Math.round(activeCalories),
    protein: Math.round(macroGoals.protein),
    carbs: Math.round(macroGoals.carbs),
    fat: Math.round(macroGoals.fat),
    ...(profile.goalWeightKg
      ? {
          goalWeight: profile.units === "metric" ? profile.goalWeightKg : kgToLb(profile.goalWeightKg),
          goalWeightUnit: profile.units === "metric" ? "kg" as WeightUnit : "lb" as WeightUnit,
        }
      : {}),
    calculatorInputs: {
      age: String(profile.age),
      sex: profile.sex,
      height: String(profile.heightCm),
      heightFeet: "",
      heightInches: "",
      heightUnit: "cm",
      weight: String(profile.weightKg),
      weightUnit: "kg",
      activityLevel: toCalculatorActivityLevel(profile.activityLevel),
      goal: profile.goal,
      rate: profile.weeklyRateKg <= 0.25 ? "mild" : profile.weeklyRateKg >= 0.75 ? "aggressive" : "moderate",
    },
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

function getShortDayName(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dow];
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

function formatHeightValue(heightCm: number, units: ProfileUnits) {
  if (units === "metric") return `${Number(heightCm.toFixed(1))} cm`;

  const totalInches = cmToTotalInches(heightCm);
  const feet = Math.floor(totalInches / 12);
  const inches = Number((totalInches - feet * 12).toFixed(1));
  return `${feet} ft ${inches} in`;
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

export type { Food, RecipeIngredient, Recipe, FoodPortion, FoodNutrient, FoodDetail, PortionOption, AddFoodTab, AppView, FoodLibraryTab, Sex, ActivityLevel, GoalType, GoalRate, ProfileActivityLevel, ProfileUnits, MacroMode, MacroPreset, HeightUnit, WeightUnit, LibrarySelection, CalculatorInputs, TopFoodEntry, Goals, Profile, ProfileForm, ProfileCalculation, WeightRange, WeightEntry, WeightForm, CustomFoodForm, FoodLogImportDraft, FoodLogImportResult, ScannedNutritionFields, RecipeForm, AmountUnit, MeasuredAmountUnit, DebugLogEntry, GoogleTokenResponse, GoogleTokenClient, GoogleAccounts, GoogleDriveUploadResponse, GoogleDriveFile, GoogleDriveFileListResponse, MealCategory, LogItem, SavedLogItem };
export { mealCategories, poundsPerKilogram, debugLogKey, googleDriveClientIdKey, googleDriveScope, googleIdentityScriptUrl, iconBaseUrl, foodIconRules, emptyCustomFoodForm, emptyRecipeForm, defaultCalculatorInputs, profileActivityMultipliers, profileActivityLabels, profileActivityOptions, profilePaceOptions, profileWizardSteps, macroPresets, maxHeightInches, maxHeightCm, minProfileHeightCm, maxProfileHeightCm, minProfileWeightKg, maxProfileWeightKg, brandSynonyms, appendDebugLog, getStorageArray, setStorageJson, verifyStorageCount, getSavedLog, getSavedCustomFoods, saveCustomFoods, getSavedRecipes, getSavedWeightEntries, saveWeightEntries, getSavedCompletedDays, saveCompletedDays, getSavedTopFoods, saveTopFoods, escapeRegExp, matchesFoodIconKeyword, getFoodIconUrl, isRecord, readStringField, readOptionalNumberField, isValidLogDate, validateImportDraft, buildImportDraft, parseFoodLogImportJson, normalizeMealName, getMealCategoriesForLog, getSavedGoals, getSavedProfile, toProfileActivityLevel, toCalculatorActivityLevel, kgToLb, lbToKg, cmToTotalInches, formatProfileNumber, profileToForm, profileFormFromLegacyGoals, getProfileHeightCm, getProfileWeightKg, getProfileGoalWeightKg, calculateProfile, getProfileValidationErrors, profileFormToProfile, profileToGoals, calculatorInputsToForm, saveRecipes, shiftDate, getLocalDateString, getDateRangeEnding, cleanPortionText, formatPortionAmount, formatGramWeight, getLocalPortionUnit, formatLocalPortionAmount, getPortionLabel, getPortionOptions, getEnergyCaloriesPer100Units, getLabelCaloriesPerServing, parseServingSize, isGramUnit, normalizeAmountUnit, getMeasuredServingBasis, convertAmountToBasisUnit, getScaleFromServingBasis, getServingSizeBasis, hasUsableSearchNutrition, getServingSizeLabel, scaleFoodNutrition, foodFromDetailNutrition, getFoodForSelectedPortion, getCaloriesPerServing, getModalResultCalories, getRecentFoods, matchesFoodQuery, normalizeSearchText, getSearchTokens, getSearchSynonyms, getFoodSearchScore, rankSearchResults, detectMilkType, formatDisplayName, getFoodDisplayName, getBrandDisplayName, getIngredientCalories, getIngredientMacro, getRecipeTotals, parseRecipe, foodToCustomFoodForm, recipeToRecipeForm, parseCustomFood, normalizeOcrText, parseOcrNumber, formatScannedNumber, getNutritionLine, extractNutritionAmount, extractCalories, extractServingSize, parseNutritionLabelText, formatMacro, getMacroGoals, getHeightCm, getWeekDates, formatShortDate, formatEntryDate, formatWeekOf, getDayLetter, getShortDayName, formatDateRange, formatWeightValue, formatHeightValue, convertWeightValue, formatWeightValueInUnit, roundToIncrement, getNiceWeightStep, getWeightTickLabel, sortWeightEntriesNewestFirst, sortWeightEntriesOldestFirst, getPreferredWeightUnit, getWeightRangeStartDate, getWeightRangeLabel, parseDecimalInput, createClientId, getConfiguredGoogleClientId, fetchUsdaFoods, searchUsdaFoodsWithSynonyms };
