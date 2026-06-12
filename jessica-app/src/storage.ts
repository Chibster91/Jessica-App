import type { DebugLogEntry, Food, FoodLogImportDraft, FoodLogImportResult, Goals, LogItem, MealCategory, Profile, Recipe, SavedLogItem, TopFoodEntry, WeightEntry, WeightImportEntry } from "./types";
import { createClientId, isRecord, mealCategories, parseDecimalInput, readOptionalNumberField, readStringField } from "./format";

export const debugLogKey = "jessicaDebugLog";

export const googleDriveClientIdKey = "googleDriveClientId";

export const oauthPendingActionKey = "oauthPendingAction";

export const googleDriveScope = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";

export const googleIdentityScriptUrl = "https://accounts.google.com/gsi/client";

export function appendDebugLog(event: string, detail?: unknown) {
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

export function getStorageArray<T>(key: string, fallback: T[] = []) {
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

export function setStorageJson(key: string, value: unknown) {
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

export const debugModeKey = "debugMode";

let debugModeCache: boolean | null = null;

export function isDebugEnabled() {
  if (debugModeCache === null) {
    try {
      debugModeCache = localStorage.getItem(debugModeKey) === "1";
    } catch {
      debugModeCache = false;
    }
  }
  return debugModeCache;
}

/**
 * Persists ?debug=1 / ?debug=0 from the URL into localStorage. The flag is stored
 * rather than read live because the installed PWA has no address bar — visiting
 * once with ?debug=1 turns instrumentation on until ?debug=0 clears it.
 * Call once at startup, before the first isDebugEnabled() check.
 */

export function applyDebugFlagFromUrl() {
  try {
    const param = new URLSearchParams(window.location.search).get("debug");
    if (param === null) return;
    if (param === "0" || param === "false") localStorage.removeItem(debugModeKey);
    else localStorage.setItem(debugModeKey, "1");
    debugModeCache = null;
  } catch {
    // URL or storage unavailable; leave the flag as-is.
  }
}

export function verifyStorageCount(key: string, expectedCount: number) {
  if (!isDebugEnabled()) return true;
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

export const schemaVersionKey = "schemaVersion";

export const currentSchemaVersion = 1;

// Storage migrations, keyed by the version they upgrade TO. Version 1 is the
// baseline stamp for the shapes that existed before versioning; add an entry
// here (and bump currentSchemaVersion) whenever a stored shape changes, e.g.:
//   2: () => { const foods = getStorageArray<Food>("customFoods"); ...; setStorageJson("customFoods", upgraded); },

export const storageMigrations: Record<number, (() => void) | undefined> = {};

export function runStorageMigrations() {
  let storedVersion: number;
  try {
    storedVersion = Number(localStorage.getItem(schemaVersionKey) ?? 0);
  } catch {
    return;
  }
  if (!Number.isInteger(storedVersion) || storedVersion < 0) storedVersion = 0;
  if (storedVersion >= currentSchemaVersion) return;

  for (let version = storedVersion + 1; version <= currentSchemaVersion; version += 1) {
    const migrate = storageMigrations[version];
    try {
      migrate?.();
      localStorage.setItem(schemaVersionKey, String(version));
      if (migrate) appendDebugLog("storage-migrated", { version });
    } catch (error) {
      appendDebugLog("storage-migration-failed", {
        version,
        message: error instanceof Error ? error.message : String(error),
      });
      return;
    }
  }
}

export function getSavedLog(date: string) {
  return getStorageArray<SavedLogItem>(`log-${date}`).map((item) => ({
    ...item,
    category: item.category ?? "Snacks",
    quantity: item.quantity ?? 1,
  }));
}

export function getItemCalories(item: Pick<LogItem, "calories" | "quantity">) {
  return Math.round(item.calories * item.quantity);
}

export function getLogCategoryTotals(log: LogItem[], category: MealCategory) {
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

export function getSavedCustomFoods() {
  return getStorageArray<Food>("customFoods");
}

export function saveCustomFoods(foods: Food[]) {
  setStorageJson("customFoods", foods);
}

export function getSavedRecipes() {
  return getStorageArray<Recipe>("recipes");
}

export function getSavedWeightEntries() {
  return getStorageArray<WeightEntry>("weightEntries");
}

export function saveWeightEntries(entries: WeightEntry[]) {
  setStorageJson("weightEntries", entries);
}

export function getSavedCompletedDays(): string[] {
  return getStorageArray<string>("completedDays");
}

export function saveCompletedDays(days: string[]): void {
  setStorageJson("completedDays", days);
}

export function getSavedTopFoods(): TopFoodEntry[] {
  return getStorageArray<TopFoodEntry>("topFoods");
}

export function saveTopFoods(foods: TopFoodEntry[]): void {
  setStorageJson("topFoods", foods);
}

export function isValidLogDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

export function validateImportDraft(item: FoodLogImportDraft, index: number) {
  const errors: string[] = [];
  const row = `Item ${index + 1}`;
  const calories = parseDecimalInput(item.calories);
  const protein = parseDecimalInput(item.protein || "0");
  const carbs = parseDecimalInput(item.carbs || "0");
  const fat = parseDecimalInput(item.fat || "0");
  const quantity = parseDecimalInput(item.quantity || "1");

  if (!isValidLogDate(item.date)) errors.push(`${row}: date must be YYYY-MM-DD.`);
  if (!item.meal.trim()) errors.push(`${row}: meal is required.`);
  if (!item.name.trim()) errors.push(`${row}: name is required.`);
  if (!item.serving.trim()) errors.push(`${row}: serving is required.`);
  if (!Number.isFinite(quantity) || quantity <= 0) errors.push(`${row}: servings must be a positive number when provided.`);
  if (!Number.isFinite(calories) || calories < 0) errors.push(`${row}: calories must be a non-negative number.`);
  if (![protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0)) {
    errors.push(`${row}: protein, carbs, and fat must be non-negative numbers when provided.`);
  }

  return errors;
}

export function buildImportDraft(date: string, meal: string, item: unknown): FoodLogImportDraft | null {
  if (!isRecord(item)) return null;

  const macros = isRecord(item.macros) ? item.macros : {};
  const serving = readStringField(item, ["serving", "servingSize", "portion"]);

  return {
    id: createClientId(),
    date,
    meal,
    name: readStringField(item, ["name", "food", "foodName"]),
    brand: readStringField(item, ["brand", "brandName"]),
    serving,
    quantity: readStringField(item, ["servings", "quantity", "servingCount"]) || "1",
    calories: readStringField(item, ["calories", "kcal"]),
    protein: readOptionalNumberField({ ...macros, ...item }, ["protein"]),
    carbs: readOptionalNumberField({ ...macros, ...item }, ["carbs", "carbohydrates"]),
    fat: readOptionalNumberField({ ...macros, ...item }, ["fat"]),
    notes: readStringField(item, ["notes", "note"]),
    source: readStringField(item, ["source"]),
  };
}

export function parseFoodLogImportJson(json: unknown): FoodLogImportResult {
  if (!isRecord(json) && !Array.isArray(json)) {
    return { ok: false, errors: ["Import file must be a JSON object or array of day objects."] };
  }

  const isMulti = Array.isArray(json);
  const days: unknown[] = isMulti ? json : [json];
  const items: FoodLogImportDraft[] = [];
  const weightEntries: WeightImportEntry[] = [];
  const errors: string[] = [];

  days.forEach((day, dayIndex) => {
    const prefix = isMulti ? `Day ${dayIndex + 1}: ` : "";

    if (!isRecord(day)) {
      errors.push(isMulti ? `Day ${dayIndex + 1} must be a JSON object.` : "Import file must be a JSON object.");
      return;
    }

    const date = readStringField(day, ["date"]);
    if (!date) {
      errors.push(`${prefix}date is required.`);
    } else if (!isValidLogDate(date)) {
      errors.push(`${prefix}date must be YYYY-MM-DD.`);
    }

    if (isRecord(day.weightEntry)) {
      const w = Number(day.weightEntry.weight);
      if (!date || !isValidLogDate(date)) {
        // date error already pushed above
      } else if (!Number.isFinite(w) || w <= 0) {
        errors.push(`${prefix}weightEntry.weight must be a positive number (in lbs).`);
      } else {
        weightEntries.push({ id: createClientId(), date, weightLb: w });
      }
    }

    if (Array.isArray(day.meals)) {
      day.meals.forEach((mealValue, mealIndex) => {
        if (!isRecord(mealValue)) {
          errors.push(`${prefix}Meal ${mealIndex + 1}: must be an object.`);
          return;
        }
        const mealName = readStringField(mealValue, ["name", "meal", "mealName"]);
        const mealItems = Array.isArray(mealValue.items)
          ? mealValue.items
          : Array.isArray(mealValue.foods)
            ? mealValue.foods
            : null;
        if (!mealName) errors.push(`${prefix}Meal ${mealIndex + 1}: name is required.`);
        if (!mealItems) {
          errors.push(`${prefix}Meal ${mealIndex + 1}: items must be an array.`);
          return;
        }
        mealItems.forEach((food, foodIndex) => {
          const draft = buildImportDraft(date, mealName, food);
          if (draft) items.push(draft);
          else errors.push(`${prefix}Meal ${mealIndex + 1}, item ${foodIndex + 1}: must be an object.`);
        });
      });
    } else if ("items" in day || "meal" in day || "mealName" in day) {
      const mealName = readStringField(day, ["meal", "mealName"]);
      if (!mealName) errors.push(`${prefix}meal name is required.`);
      if (!Array.isArray(day.items)) {
        errors.push(`${prefix}items must be an array.`);
      } else {
        day.items.forEach((food, index) => {
          const draft = buildImportDraft(date, mealName, food);
          if (draft) items.push(draft);
          else errors.push(`${prefix}Item ${index + 1}: must be an object.`);
        });
      }
    }
  });

  if (items.length === 0 && weightEntries.length === 0) {
    errors.push("Import file must include at least one food item or weight entry.");
  }
  items.forEach((item, index) => errors.push(...validateImportDraft(item, index)));

  return errors.length > 0 ? { ok: false, errors } : { ok: true, items, weightEntries, isMultiDay: isMulti };
}

export function normalizeMealName(meal: string) {
  return meal.trim().replace(/\s+/g, " ");
}

export function getMealCategoriesForLog(items: LogItem[]) {
  const importedMeals = items.map((item) => item.category).filter((category) => !mealCategories.includes(category));
  return [...mealCategories, ...Array.from(new Set(importedMeals))];
}

export function getSavedGoals(): Goals | null {
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

export function getSavedProfile(): Profile | null {
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

export function saveRecipes(recipes: Recipe[]) {
  setStorageJson("recipes", recipes);
}

export function getConfiguredGoogleClientId() {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || localStorage.getItem(googleDriveClientIdKey) || "";
}

