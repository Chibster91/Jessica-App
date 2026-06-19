import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  setStorageJson,
  getSavedLog,
  getMeasuredServingBasis,
  getFoodDensity,
  convertAmountToBasisUnit,
  getScaleFromServingBasis,
  scaleFoodNutrition,
  parseRecipe,
  formatShortDate,
  parseDecimalInput,
  createClientId,
  type AmountUnit,
  type LogItem,
  type MealCategory,
  type Recipe,
} from "../appSupport";

type UseLogItemActionsArgs = {
  selectedDate: string;
  log: LogItem[];
  setLog: Dispatch<SetStateAction<LogItem[]>>;
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
};

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

/**
 * Day-view meal-card and dialog state: expand/collapse, the log menu, and the
 * edit / remove / move / context-menu / save-meal-as-recipe dialogs. Lives inside
 * LogView so dialog keystrokes don't re-render App; drafts reset on navigation.
 */
export function useLogItemActions({ selectedDate, log, setLog, recipes, setRecipes }: UseLogItemActionsArgs) {
  const mealCardRefs = useRef<Partial<Record<MealCategory, HTMLElement | null>>>({});
  const longPressRef = useRef<{ logId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressNextClickRef = useRef<string | null>(null);
  const [isLogMenuOpen, setIsLogMenuOpen] = useState(false);
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
  const [itemToRemove, setItemToRemove] = useState<LogItem | null>(null);

  function toggleMeal(category: MealCategory) {
    setExpandedMeals((current) => ({ ...current, [category]: !current[category] }));
  }

  function scrollToMeal(category: MealCategory) {
    setExpandedMeals((current) => ({ ...current, [category]: true }));
    window.requestAnimationFrame(() => {
      mealCardRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  function openEditFoodItem(item: LogItem) {
    setItemToEdit(item);
    setEditItemAmount(String(item.amount ?? item.quantity ?? 1));
    setEditItemAmountUnit(item.amountUnit ?? "serving");
  }

  function saveEditedFoodItem(amountOverride?: string) {
    if (!itemToEdit) return;

    const amount = parseDecimalInput(amountOverride ?? editItemAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    const effectiveUnit: AmountUnit = amountOverride !== undefined ? "serving" : editItemAmountUnit;
    const amountLabel = formatAmountLabel(amount);

    setLog(
      log.map((item) =>
        item.logId === itemToEdit.logId
          ? (() => {
              if (effectiveUnit === "serving") {
                const servingName = item.portionLabel ?? item.servingSize;
                return {
                  ...item,
                  quantity: amount,
                  amount,
                  amountUnit: effectiveUnit,
                  servingLabel: amount === 1 ? servingName : `${amountLabel} x ${servingName}`,
                };
              }

              const measuredBasis = getMeasuredServingBasis(item);
              if (!measuredBasis) return item;

              const basisAmount = convertAmountToBasisUnit(amount, effectiveUnit, measuredBasis.unit, getFoodDensity(item));
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
                amountUnit: effectiveUnit,
                portionScale:
                  item.portionScale !== undefined && Number.isFinite(item.portionScale)
                    ? item.portionScale * amountScale
                    : item.portionScale,
                servingLabel: `${amountLabel} ${effectiveUnit}`,
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

  return {
    mealCardRefs,
    longPressRef,
    suppressNextClickRef,
    isLogMenuOpen,
    setIsLogMenuOpen,
    expandedMeals,
    toggleMeal,
    scrollToMeal,
    mealMenuCategory,
    setMealMenuCategory,
    mealToSaveAsRecipe,
    setMealToSaveAsRecipe,
    mealRecipeName,
    setMealRecipeName,
    openSaveMealAsRecipe,
    saveMealAsRecipe,
    mealToDelete,
    setMealToDelete,
    confirmDeleteMeal,
    contextMenuItem,
    setContextMenuItem,
    contextMenuY,
    setContextMenuY,
    moveToMealItem,
    setMoveToMealItem,
    moveItemToMeal,
    moveToDayItem,
    setMoveToDayItem,
    moveToDayDate,
    setMoveToDayDate,
    moveToDayStep,
    setMoveToDayStep,
    moveItemToDifferentDay,
    itemToEdit,
    setItemToEdit,
    editItemAmount,
    setEditItemAmount,
    editItemAmountUnit,
    setEditItemAmountUnit,
    getEditAmountUnits,
    openEditFoodItem,
    saveEditedFoodItem,
    itemToRemove,
    setItemToRemove,
    confirmRemoveFood,
  };
}
