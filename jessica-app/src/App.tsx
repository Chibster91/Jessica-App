import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";
import { recognize } from "tesseract.js";
import { AppChrome } from "./components/AppChrome";
import { FoodLibraryView } from "./components/FoodLibraryView";
import { HomeView } from "./components/HomeView";
import { ProfileView } from "./components/ProfileView";
import { WeightView } from "./components/WeightView";
import EggOracle from "./features/egg-oracle/EggOracle";
import {
  debugLogKey,
  googleDriveClientIdKey,
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
  getFoodIconUrl,
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
  hasUsableSearchNutrition,
  getFoodForSelectedPortion,
  getCaloriesPerServing,
  getModalResultCalories,
  getRecentFoods,
  matchesFoodQuery,
  getFoodDisplayName,
  getBrandDisplayName,
  getIngredientCalories,
  getRecipeTotals,
  parseRecipe,
  foodToCustomFoodForm,
  recipeToRecipeForm,
  parseCustomFood,
  normalizeOcrText,
  parseNutritionLabelText,
  formatMacro,
  formatShortDate,
  formatEntryDate,
  sortWeightEntriesNewestFirst,
  sortWeightEntriesOldestFirst,
  getPreferredWeightUnit,
  getWeightRangeStartDate,
  parseDecimalInput,
  createClientId,
  getConfiguredGoogleClientId,
  searchUsdaFoodsWithSynonyms,
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
  type ScannedNutritionFields,
  type RecipeForm,
  type AmountUnit,
  type GoogleDriveUploadResponse,
  type GoogleDriveFile,
  type GoogleDriveFileListResponse,
  type MealCategory,
  type LogItem
} from "./appSupport";
import "./App.css";

function App() {
  const today = getLocalDateString();
  const customFoodScanInputRef = useRef<HTMLInputElement | null>(null);
  const foodLogImportInputRef = useRef<HTMLInputElement | null>(null);
  const mealCardRefs = useRef<Partial<Record<MealCategory, HTMLElement | null>>>({});
  const longPressRef = useRef<{ logId: string; timer: ReturnType<typeof setTimeout> } | null>(null);
  const suppressNextClickRef = useRef<string | null>(null);
  const [appView, setAppView] = useState<AppView>(() => (getSavedProfile() ? "home" : "profile"));
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
  const [isProfileWizardOpen, setIsProfileWizardOpen] = useState(() => !getSavedProfile());
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
  const [itemToEdit, setItemToEdit] = useState<LogItem | null>(null);
  const [editItemQuantity, setEditItemQuantity] = useState("1");
  const [editItemServingSize, setEditItemServingSize] = useState("");
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("serving");
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [exportDriveLink, setExportDriveLink] = useState("");
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [googleDriveClientId, setGoogleDriveClientId] = useState(() => getConfiguredGoogleClientId());
  const [importDrafts, setImportDrafts] = useState<FoodLogImportDraft[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState("");
  const [importFileName, setImportFileName] = useState("");
  const [driveImportFiles, setDriveImportFiles] = useState<GoogleDriveFile[]>([]);
  const [driveImportStatus, setDriveImportStatus] = useState("");
  const [isDriveImportOpen, setIsDriveImportOpen] = useState(false);
  const [isLoadingDriveImport, setIsLoadingDriveImport] = useState(false);

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

  async function readFoodLogImport(file: File | undefined) {
    setImportStatus("");
    setImportErrors([]);
    setImportFileName(file?.name ?? "");

    if (!file) return;

    try {
      loadFoodLogImportText(await file.text(), file.name);
    } catch (error) {
      setImportDrafts([]);
      setImportErrors([`Could not read JSON: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      if (foodLogImportInputRef.current) foodLogImportInputRef.current.value = "";
    }
  }

  function loadFoodLogImportText(text: string, fileName: string) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const result = parseFoodLogImportJson(parsed);

      setImportFileName(fileName);
      setImportStatus("");

      if (result.ok === false) {
        setImportDrafts([]);
        setImportErrors(result.errors);
        return;
      }

      setImportErrors([]);
      setImportDrafts(result.items);
    } catch (error) {
      setImportDrafts([]);
      setImportErrors([`Could not read JSON: ${error instanceof Error ? error.message : String(error)}`]);
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

  function closeImportPreview() {
    setImportDrafts([]);
    setImportErrors([]);
    setImportFileName("");
  }

  function confirmFoodLogImport() {
    const validationErrors = importDrafts.flatMap((item, index) => validateImportDraft(item, index));
    if (validationErrors.length > 0) {
      setImportErrors(validationErrors);
      return;
    }

    const importedFoods = importDrafts.map((item, index) => {
      const food: Food = {
        id: -(Date.now() + index + 1),
        name: item.name.trim(),
        brand: null,
        source: item.source.trim() || undefined,
        servingSize: item.serving.trim(),
        calories: Math.round(parseDecimalInput(item.calories)),
        protein: parseDecimalInput(item.protein || "0"),
        carbs: parseDecimalInput(item.carbs || "0"),
        fat: parseDecimalInput(item.fat || "0"),
        notes: item.notes.trim() || undefined,
      };

      return {
        date: item.date,
        meal: normalizeMealName(item.meal),
        food,
      };
    });

    const nextLogsByDate = new Map<string, LogItem[]>();
    for (const entry of importedFoods) {
      const existingLog = nextLogsByDate.get(entry.date) ?? (entry.date === selectedDate ? log : getSavedLog(entry.date));
      nextLogsByDate.set(entry.date, [
        ...existingLog,
        {
          ...entry.food,
          logId: createClientId(),
          category: entry.meal,
          quantity: 1,
        },
      ]);
    }

    for (const [date, nextLog] of nextLogsByDate) {
      setStorageJson(`log-${date}`, nextLog);
    }

    setCustomFoods((current) => [...importedFoods.map((entry) => entry.food), ...current]);
    setTopFoods((current) => {
      const counts = new Map(current.map((food) => [food.name, food.count]));
      importedFoods.forEach((entry) => {
        counts.set(entry.food.name, (counts.get(entry.food.name) ?? 0) + 1);
      });

      return Array.from(counts, ([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    });

    const firstDate = importedFoods[0]?.date ?? selectedDate;
    if (nextLogsByDate.has(firstDate)) {
      setSelectedDate(firstDate);
      setLog(nextLogsByDate.get(firstDate) ?? getSavedLog(firstDate));
    }

    setImportStatus(`Imported ${importedFoods.length} food${importedFoods.length === 1 ? "" : "s"}.`);
    closeImportPreview();
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
        } catch {}
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

  async function openDriveImport() {
    if (isLoadingDriveImport) return;

    const clientId = googleDriveClientId.trim();
    setExportDriveLink("");
    setDriveImportFiles([]);

    if (!clientId) {
      setExportStatus("Add your Google OAuth Client ID first.");
      return;
    }

    localStorage.setItem(googleDriveClientIdKey, clientId);
    setDriveImportStatus("Opening Google authorization...");
    setIsLoadingDriveImport(true);

    try {
      const accessToken = await getGoogleDriveAccessToken(clientId);
      setDriveImportStatus("Loading JSON files from Google Drive...");

      const params = new URLSearchParams({
        pageSize: "20",
        orderBy: "modifiedTime desc",
        spaces: "drive",
        fields: "files(id,name,modifiedTime,size)",
        q: "(mimeType='application/json' or name contains '.json') and trashed=false",
      });
      const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await getGoogleDriveRequestError(response, "file list"));
      }

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

  async function importGoogleDriveFile(file: GoogleDriveFile) {
    if (isLoadingDriveImport) return;

    const clientId = googleDriveClientId.trim();
    if (!clientId) {
      setDriveImportStatus("Add your Google OAuth Client ID first.");
      return;
    }

    setIsLoadingDriveImport(true);
    setDriveImportStatus(`Loading ${file.name}...`);

    try {
      const accessToken = await getGoogleDriveAccessToken(clientId);
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(await getGoogleDriveRequestError(response, "file download"));
      }

      loadFoodLogImportText(await response.text(), file.name);
      setDriveImportStatus("");
      setIsDriveImportOpen(false);
      setIsExportPanelOpen(false);
    } catch (error) {
      setDriveImportStatus(error instanceof Error ? error.message : "Could not import that Google Drive file.");
    } finally {
      setIsLoadingDriveImport(false);
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
  const canAddSelectedFood =
    Boolean(selectedFood) &&
    !isLoadingDetail &&
    (amountUnit === "serving" || (allowedAmountUnits.includes(amountUnit) && localPortionScale !== null)) &&
    (portionOptions.length === 0 || Boolean(selectedPortion));
  const profileCalculation = calculateProfile(profileForm);
  const profileErrors = getProfileValidationErrors(profileForm);
  const profileHasBlockingErrors = Object.keys(profileErrors).length > 0 || profileCalculation === null;
  const profileLowCalorieThreshold = profileForm.sex === "female" ? 1200 : 1500;
  const profileLowCalorieWarning =
    profileCalculation && profileCalculation.activeCalories < profileLowCalorieThreshold
      ? `This target is below ${profileLowCalorieThreshold} kcal/day. Consider a slower rate.`
      : "";

  const bottomNav = (
    <AppChrome
      appView={appView}
      onNavigate={(view) => {
        setLibrarySelection(null);
        cancelLibraryEditing();
        setAppView(view);
      }}
      onOpenLibrary={openFoodLibrary}
      onOpenDebugPanel={openDebugPanel}
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


  if (appView === "home") {
    return (
      <HomeView
        bottomNav={bottomNav}
        selectedDate={selectedDate}
        log={log}
        goals={goals}
        homeSelectedDate={homeSelectedDate}
        setHomeSelectedDate={setHomeSelectedDate}
        changeSelectedDate={changeSelectedDate}
        toggleHomeDate={toggleHomeDate}
        today={today}
        getCompletedStreak={getCompletedStreak}
        goalsView={goalsView}
        setGoalsView={setGoalsView}
        currentWeightEntry={currentWeightEntry}
        startingWeightEntry={startingWeightEntry}
        weightUnit={weightUnit}
      />
    );
  }

if (appView === "egg-oracle") {
  return <EggOracle bottomNav={bottomNav} />;
}

  if (appView === "profile") {
    return (
      <ProfileView
        bottomNav={bottomNav}
        profile={profile}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        updateProfileForm={updateProfileForm}
        profileCalculation={profileCalculation}
        profileErrors={profileErrors}
        profileHasBlockingErrors={profileHasBlockingErrors}
        profileLowCalorieWarning={profileLowCalorieWarning}
        profileWizardStep={profileWizardStep}
        setProfileWizardStep={setProfileWizardStep}
        isProfileWizardOpen={isProfileWizardOpen}
        setIsProfileWizardOpen={setIsProfileWizardOpen}
        profileSaveStatus={profileSaveStatus}
        setProfileSaveStatus={setProfileSaveStatus}
        cancelProfileChanges={cancelProfileChanges}
        saveProfile={saveProfile}
        onOpenExport={exportAllData}
        onOpenImport={() => foodLogImportInputRef.current?.click()}
        onConnectDrive={openDriveImport}
        onDeleteAllData={clearAllData}
      />
    );
  }

  if (appView === "weight") {
    return (
      <WeightView
        bottomNav={bottomNav}
        today={today}
        weightUnit={weightUnit}
        profile={profile}
        chartWeightEntries={chartWeightEntries}
        currentWeightEntry={currentWeightEntry}
        startingWeightEntry={startingWeightEntry}
        weightForm={weightForm}
        setWeightForm={setWeightForm}
        weightSaveError={weightSaveError}
        setWeightSaveError={setWeightSaveError}
        isWeightFormValid={isWeightFormValid}
        editingWeightEntryId={editingWeightEntryId}
        setEditingWeightEntryId={setEditingWeightEntryId}
        saveWeightEntry={saveWeightEntry}
        tapProbeProps={tapProbeProps}
        logTapProbe={logTapProbe}
        weightRange={weightRange}
        setWeightRange={setWeightRange}
        weightChartPointId={weightChartPointId}
        setWeightChartPointId={setWeightChartPointId}
        sortedWeightEntriesOldest={sortedWeightEntriesOldest}
        sortedWeightEntriesNewest={sortedWeightEntriesNewest}
        startEditWeightEntry={startEditWeightEntry}
        weightEntryToDelete={weightEntryToDelete}
        setWeightEntryToDelete={setWeightEntryToDelete}
        confirmDeleteWeightEntry={confirmDeleteWeightEntry}
      />
    );
  }

  if (appView === "library") {
    return (
      <FoodLibraryView
        bottomNav={bottomNav}
        foodLibraryTab={foodLibraryTab}
        setFoodLibraryTab={setFoodLibraryTab}
        libraryQuery={libraryQuery}
        setLibraryQuery={setLibraryQuery}
        librarySelection={librarySelection}
        setLibrarySelection={setLibrarySelection}
        cancelLibraryEditing={cancelLibraryEditing}
        createLibraryCustomFood={createLibraryCustomFood}
        createLibraryRecipe={createLibraryRecipe}
        libraryRecentFoods={libraryRecentFoods}
        libraryCustomFoods={libraryCustomFoods}
        libraryRecipes={libraryRecipes}
        isCreatingLibraryCustomFood={isCreatingLibraryCustomFood}
        isCreatingLibraryRecipe={isCreatingLibraryRecipe}
        editingCustomFoodId={editingCustomFoodId}
        editingRecipeId={editingRecipeId}
        editCustomFood={editCustomFood}
        deleteCustomFood={deleteCustomFood}
        libraryCustomFoodForm={libraryCustomFoodForm}
        setLibraryCustomFoodForm={setLibraryCustomFoodForm}
        saveNewLibraryCustomFood={saveNewLibraryCustomFood}
        saveLibraryCustomFood={saveLibraryCustomFood}
        editRecipe={editRecipe}
        deleteRecipe={deleteRecipe}
        libraryRecipeForm={libraryRecipeForm}
        setLibraryRecipeForm={setLibraryRecipeForm}
        recipeIngredientQuery={recipeIngredientQuery}
        setRecipeIngredientQuery={setRecipeIngredientQuery}
        searchRecipeIngredientFoods={searchRecipeIngredientFoods}
        recipeIngredientOptions={recipeIngredientOptions}
        pendingRecipeIngredient={pendingRecipeIngredient}
        selectRecipeIngredient={selectRecipeIngredient}
        isSearchingRecipeIngredients={isSearchingRecipeIngredients}
        pendingRecipeIngredientQuantity={pendingRecipeIngredientQuantity}
        setPendingRecipeIngredientQuantity={setPendingRecipeIngredientQuantity}
        confirmLibraryRecipeIngredient={confirmLibraryRecipeIngredient}
        setPendingRecipeIngredient={setPendingRecipeIngredient}
        libraryRecipeIngredients={libraryRecipeIngredients}
        updateLibraryRecipeIngredientQuantity={updateLibraryRecipeIngredientQuantity}
        removeLibraryRecipeIngredient={removeLibraryRecipeIngredient}
        saveNewLibraryRecipe={saveNewLibraryRecipe}
        saveLibraryRecipe={saveLibraryRecipe}
      />
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
            <div className="log-date-row">
              <button type="button" onClick={() => moveSelectedDate(-1)} aria-label="Previous day">
                ‹
              </button>
              <label className="log-date-label" aria-label="Pick date">
                <strong>{formatEntryDate(selectedDate)}</strong>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => changeSelectedDate(e.target.value)}
                />
              </label>
              <button type="button" onClick={() => moveSelectedDate(1)} aria-label="Next day">
                ›
              </button>
            </div>
            <div className="log-file-actions">
              <button
                type="button"
                className="log-import-button"
                onClick={openDriveImport}
                disabled={isUploadingToDrive || isLoadingDriveImport}
              >
                {isLoadingDriveImport ? "Loading Drive..." : "Import JSON"}
              </button>
              <label className="log-local-import-button">
                Import File
                <input
                  ref={foodLogImportInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => readFoodLogImport(event.target.files?.[0])}
                />
              </label>
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
            {importStatus && <p className="import-inline-status">{importStatus}</p>}
            {importErrors.length > 0 && importDrafts.length === 0 && (
              <div className="import-inline-errors" role="alert">
                {importErrors.slice(0, 3).map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <section className="log-summary-card">
              <div className="log-calorie-stat">
                <span>Logged</span>
                <strong>{netCalories.toLocaleString()}</strong>
              </div>
              <div className="log-gauge-ring" style={{ "--p": calorieGaugePct } as CSSProperties}>
                <div>
                  <span>{calorieDelta >= 0 ? "Remaining" : "Over"}</span>
                  <strong>{Math.abs(calorieDelta).toLocaleString()}</strong>
                  <small>cal</small>
                </div>
              </div>
              <div className="log-calorie-stat">
                <span>Total</span>
                <strong>{calorieBudget > 0 ? calorieBudget.toLocaleString() : "Set goal"}</strong>
              </div>

              <div className="log-meal-breakdown">
                {visibleMealCategories.map((category) => {
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
              {visibleMealCategories.map((category) => {
                const mealItems = log.filter((item) => item.category === category);
                const mealTotals = getCategoryTotals(category);
                const isExpanded = expandedMeals[category];

                return (
                  <section
                    className="log-meal-card"
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
                      <div className="log-meal-title-block">
                        <h3>{category}: {mealTotals.calories.toLocaleString()}</h3>
                        <div className="log-meal-macros">
                          <span>Fat {formatMacro(mealTotals.fat)}g</span>
                          <span>Carbs {formatMacro(mealTotals.carbs)}g</span>
                          <span>Protein {formatMacro(mealTotals.protein)}g</span>
                        </div>
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

                    {isExpanded && (
                      <div className="log-food-list">
                        {mealItems.length === 0 && (
                          <p className="empty-meal">No foods logged.</p>
                        )}

                        {mealItems.map((item) => (
                          <button
                            type="button"
                            className="log-food-row"
                            key={item.logId}
                            aria-label={`Edit ${getFoodDisplayName(item)}`}
                            onClick={() => {
                              if (suppressNextClickRef.current === item.logId) {
                                suppressNextClickRef.current = null;
                                return;
                              }
                              openEditFoodItem(item);
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setItemToRemove(item);
                            }}
                            onPointerDown={() => {
                              if (longPressRef.current) clearTimeout(longPressRef.current.timer);
                              longPressRef.current = {
                                logId: item.logId,
                                timer: setTimeout(() => {
                                  longPressRef.current = null;
                                  suppressNextClickRef.current = item.logId;
                                  setItemToRemove(item);
                                }, 500),
                              };
                            }}
                            onPointerUp={() => {
                              if (longPressRef.current) {
                                clearTimeout(longPressRef.current.timer);
                                longPressRef.current = null;
                              }
                            }}
                            onPointerLeave={() => {
                              if (longPressRef.current) {
                                clearTimeout(longPressRef.current.timer);
                                longPressRef.current = null;
                              }
                            }}
                            onPointerCancel={() => {
                              if (longPressRef.current) {
                                clearTimeout(longPressRef.current.timer);
                                longPressRef.current = null;
                              }
                            }}
                          >
                            <div className="log-food-icon" aria-hidden="true">
                              <img src={getFoodIconUrl(item)} alt="" />
                            </div>
                            <div className="log-food-main">
                              <strong>{getFoodDisplayName(item)}</strong>
                              <span>{item.quantity === 1 ? item.servingSize : `${item.servingSize} × ${item.quantity}`}</span>
                            </div>
                            <div className="log-food-calories">
                              <strong>{getItemCalories(item)}</strong>
                              <span>cal</span>
                            </div>
                          </button>
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
                        <span className="food-card-title">
                          <img src={getFoodIconUrl(food)} alt="" />
                          <strong>{getFoodDisplayName(food)}</strong>
                        </span>
                        <span className="food-card-meta">
                          {food.brand
                            ? <span>{getBrandDisplayName(food.brand)}</span>
                            : <span className="food-card-source">{food.dataType ?? "USDA"}</span>}
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
                    <span className="food-card-title">
                      <img src={getFoodIconUrl(food)} alt="" />
                      <strong>{food.name}</strong>
                    </span>
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
                        <span className="food-card-title">
                          <img src={getFoodIconUrl(food)} alt="" />
                          <strong>{food.name}</strong>
                        </span>
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
                              <span className="food-card-title">
                                <img src={getFoodIconUrl(food)} alt="" />
                                <strong>{getFoodDisplayName(food)}</strong>
                              </span>
                              <span className="food-card-meta">
                                {food.brand
                                  ? <span>{getBrandDisplayName(food.brand)}</span>
                                  : <span className="food-card-source">{food.dataType ?? "USDA"}</span>}
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
                            <span className="food-card-title">
                              <img src={getFoodIconUrl(pendingRecipeIngredient)} alt="" />
                              <strong>{pendingRecipeIngredient.name}</strong>
                            </span>
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
                            <span className="food-card-title">
                              <img src={getFoodIconUrl(ingredient.food)} alt="" />
                              <span>{ingredient.food.name}</span>
                            </span>
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
                        <span className="food-card-title">
                          <img src={getFoodIconUrl(recipe)} alt="" />
                          <strong>{recipe.name}</strong>
                        </span>
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

      {importDrafts.length > 0 && (
        <div className="floating-overlay import-preview-overlay" role="presentation">
          <div className="floating-popover import-preview-popover" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
            <div className="import-preview-header">
              <div>
                <h2 id="import-preview-title">Import Food Log</h2>
                <p>{importFileName || "JSON import"} · {importDrafts.length} item{importDrafts.length === 1 ? "" : "s"}</p>
              </div>
              <button type="button" onClick={closeImportPreview} aria-label="Close import preview">
                ×
              </button>
            </div>

            {importErrors.length > 0 && (
              <div className="import-preview-errors" role="alert">
                {importErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <div className="import-preview-list">
              {importDrafts.map((item) => (
                <div className="import-preview-item" key={item.id}>
                  <label>
                    Date
                    <input
                      type="date"
                      value={item.date}
                      onChange={(event) => updateImportDraft(item.id, { date: event.target.value })}
                    />
                  </label>
                  <label>
                    Meal
                    <input
                      value={item.meal}
                      onChange={(event) => updateImportDraft(item.id, { meal: event.target.value })}
                    />
                  </label>
                  <label className="import-wide-field">
                    Name
                    <input
                      value={item.name}
                      onChange={(event) => updateImportDraft(item.id, { name: event.target.value })}
                    />
                  </label>
                  <label>
                    Serving
                    <input
                      value={item.serving}
                      onChange={(event) => updateImportDraft(item.id, { serving: event.target.value })}
                    />
                  </label>
                  <label>
                    Calories
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.calories}
                      onChange={(event) => updateImportDraft(item.id, { calories: event.target.value })}
                    />
                  </label>
                  <label>
                    Protein
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.protein}
                      onChange={(event) => updateImportDraft(item.id, { protein: event.target.value })}
                    />
                  </label>
                  <label>
                    Carbs
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.carbs}
                      onChange={(event) => updateImportDraft(item.id, { carbs: event.target.value })}
                    />
                  </label>
                  <label>
                    Fat
                    <input
                      type="number"
                      min="0"
                      inputMode="decimal"
                      value={item.fat}
                      onChange={(event) => updateImportDraft(item.id, { fat: event.target.value })}
                    />
                  </label>
                  <label>
                    Source
                    <input
                      value={item.source}
                      onChange={(event) => updateImportDraft(item.id, { source: event.target.value })}
                    />
                  </label>
                  <label className="import-wide-field">
                    Notes
                    <textarea
                      value={item.notes}
                      onChange={(event) => updateImportDraft(item.id, { notes: event.target.value })}
                    />
                  </label>
                  <button type="button" className="danger-button" onClick={() => removeImportDraft(item.id)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="floating-actions">
              <button type="button" className="primary-button" onClick={confirmFoodLogImport}>
                Add Items
              </button>
              <button type="button" className="secondary-button" onClick={closeImportPreview}>
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
            {driveImportStatus && <p className="scan-status">{driveImportStatus}</p>}
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
            <button type="button" onClick={openDriveImport} disabled={isUploadingToDrive || isLoadingDriveImport}>
              {isLoadingDriveImport ? "Loading Drive..." : "Import Drive JSON"}
            </button>
            <button type="button" onClick={shareDayExport} disabled={isUploadingToDrive}>
              Share Sheet
            </button>
            <button type="button" className="secondary-button" onClick={() => setIsExportPanelOpen(false)} disabled={isUploadingToDrive}>
              Close
            </button>
          </div>
        </div>
      )}

      {isDriveImportOpen && (
        <div className="floating-overlay import-preview-overlay" role="presentation">
          <div className="floating-popover drive-import-popover" role="dialog" aria-modal="true" aria-labelledby="drive-import-title">
            <div className="import-preview-header">
              <div>
                <h2 id="drive-import-title">Import from Drive</h2>
                <p>Select a JSON file available to Jessica.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsDriveImportOpen(false)}
                aria-label="Close Google Drive import"
                disabled={isLoadingDriveImport}
              >
                ×
              </button>
            </div>
            {driveImportStatus && <p className="scan-status">{driveImportStatus}</p>}
            <div className="drive-import-list">
              {driveImportFiles.map((file) => (
                <button
                  type="button"
                  key={file.id}
                  className="drive-import-file"
                  onClick={() => importGoogleDriveFile(file)}
                  disabled={isLoadingDriveImport}
                >
                  <strong>{file.name}</strong>
                  <span>
                    {file.modifiedTime ? formatEntryDate(file.modifiedTime.slice(0, 10)) : "Google Drive JSON"}
                    {file.size ? ` · ${Math.ceil(Number(file.size) / 1024).toLocaleString()} KB` : ""}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setIsDriveImportOpen(false)}
              disabled={isLoadingDriveImport}
            >
              Cancel
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
