import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  emptyCustomFoodForm,
  emptyRecipeForm,
  appendDebugLog,
  setStorageJson,
  verifyStorageCount,
  getPortionOptions,
  getPreferredHouseholdPortion,
  getSearchTypicalServing,
  parseServingSize,
  getMeasuredServingBasis,
  getFoodDensity,
  convertAmountToBasisUnit,
  getScaleFromServingBasis,
  hasUsableSearchNutrition,
  getFoodForSelectedPortion,
  getCaloriesPerServing,
  toStorableFoodDetail,
  getRecentFoods,
  matchesFoodQuery,
  getFoodDisplayName,
  getBrandDisplayName,
  getRecipeTotals,
  parseRecipe,
  parseCustomFood,
  normalizeOcrText,
  parseNutritionLabelText,
  createClientId,
  searchFoodsGrouped,
  fetchUsdaFoodDetail,
  type SearchFoodsResult,
  type SearchResultGroup,
  type AddFoodTab,
  type AmountUnit,
  type CustomFoodForm,
  type Food,
  type FoodDetail,
  type LogItem,
  type MealCategory,
  type Recipe,
  type RecipeForm,
  type RecipeIngredient,
  type ScannedNutritionFields,
  type TopFoodEntry,
} from "../appSupport";
import { useRecipeIngredientSearch } from "./useRecipeIngredientSearch";

type RecentFood = Food & { loggedCount: number; lastLoggedDate: string };

type UseAddFoodModalArgs = {
  selectedDate: string;
  log: LogItem[];
  setLog: Dispatch<SetStateAction<LogItem[]>>;
  customFoods: Food[];
  setCustomFoods: Dispatch<SetStateAction<Food[]>>;
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  recentFoods: RecentFood[];
  setTopFoods: Dispatch<SetStateAction<TopFoodEntry[]>>;
};

export function useAddFoodModal({
  selectedDate,
  log,
  setLog,
  customFoods,
  setCustomFoods,
  recipes,
  setRecipes,
  recentFoods,
  setTopFoods,
}: UseAddFoodModalArgs) {
  const customFoodScanInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingCategory, setPendingCategory] = useState<MealCategory | null>(null);
  const [activeAddFoodTab, setActiveAddFoodTab] = useState<AddFoodTab>("search");
  // Defaults ON: anything other than an explicit "0" (user turned it off) enables USDA.
  const [usdaEnabled, setUsdaEnabled] = useState(() => localStorage.getItem("usdaEnabled") !== "0");
  function toggleUsda() {
    setUsdaEnabled(prev => {
      const next = !prev;
      localStorage.setItem("usdaEnabled", next ? "1" : "0");
      return next;
    });
  }
  const [modalQuery, setModalQuery] = useState("");
  const [modalFoodGroups, setModalFoodGroups] = useState<SearchResultGroup[]>([]);
  const [isSearchingFoods, setIsSearchingFoods] = useState(false);
  const [searchError, setSearchError] = useState("");
  // The query of the last completed search — distinguishes "no results" from "not searched yet".
  const [searchedQuery, setSearchedQuery] = useState("");
  const [usdaSkipped, setUsdaSkipped] = useState<SearchFoodsResult["usdaSkipped"]>(null);
  const [customQuery, setCustomQuery] = useState("");
  const [isCustomFormOpen, setIsCustomFormOpen] = useState(false);
  const [isBarcodeScanOpen, setIsBarcodeScanOpen] = useState(false);
  const [customFoodForm, setCustomFoodForm] = useState<CustomFoodForm>(emptyCustomFoodForm);
  const [customFoodOcrText, setCustomFoodOcrText] = useState("");
  const [customFoodOcrError, setCustomFoodOcrError] = useState("");
  const [customFoodSaveError, setCustomFoodSaveError] = useState("");
  const [isScanningCustomFood, setIsScanningCustomFood] = useState(false);
  const [recipeQuery, setRecipeQuery] = useState("");
  const [isRecipeFormOpen, setIsRecipeFormOpen] = useState(false);
  const [recipeForm, setRecipeForm] = useState<RecipeForm>(emptyRecipeForm);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [selectedFoodDetail, setSelectedFoodDetail] = useState<FoodDetail | null>(null);
  const [selectedPortionValue, setSelectedPortionValue] = useState("");
  const [portionAmount, setPortionAmount] = useState("100");
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amountUnit, setAmountUnit] = useState<AmountUnit>("serving");

  const {
    recipeIngredientQuery,
    setRecipeIngredientQuery,
    setRecipeIngredientFoods,
    isSearchingRecipeIngredients,
    setIsSearchingRecipeIngredients,
    pendingRecipeIngredient,
    setPendingRecipeIngredient,
    pendingRecipeIngredientQuantity,
    setPendingRecipeIngredientQuantity,
    selectRecipeIngredient,
    searchRecipeIngredientFoods,
    recipeIngredientOptions,
  } = useRecipeIngredientSearch({ customFoods, recentFoods });

  function openAddFood(category: MealCategory) {
    setPendingCategory(category);
    setActiveAddFoodTab("search");
    setModalQuery("");
    setModalFoodGroups([]);
    setIsSearchingFoods(false);
    setSearchError("");
    setSearchedQuery("");
    setUsdaSkipped(null);
    setCustomQuery("");
    setIsCustomFormOpen(false);
    setIsBarcodeScanOpen(false);
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
    setIsBarcodeScanOpen(false);
    setCustomFoodOcrText("");
    setCustomFoodOcrError("");
    setCustomFoodSaveError("");
    setIsScanningCustomFood(false);
    setIsRecipeFormOpen(false);
  }

  async function searchModalFood() {
    const query = modalQuery.trim();
    if (!query) return;

    setIsSearchingFoods(true);
    setSearchError("");
    try {
      const result = await searchFoodsGrouped(query, customFoods, getRecentFoods(selectedDate), recipes, usdaEnabled);
      setModalFoodGroups(result.groups);
      setUsdaSkipped(result.usdaSkipped);
      if (result.usdaError) {
        setSearchError(
          result.groups.length > 0
            ? "Couldn't reach the USDA food database — showing other matches."
            : "Couldn't reach the USDA food database. Check your connection and try again."
        );
      }
    } catch {
      setModalFoodGroups([]);
      setUsdaSkipped(null);
      setSearchError("Search failed. Check your connection and try again.");
    } finally {
      setSearchedQuery(query);
      setIsSearchingFoods(false);
    }
  }

  /** Re-applies a saved USDA detail (portions, label serving) to a food picked from
   * My Foods / recents, mirroring the online detail flow without a network fetch. */
  function applySavedFoodDetail(food: Food): boolean {
    const detail = food.savedDetail;
    if (!detail) return false;

    const detailBasis = getMeasuredServingBasis(food);
    const preferredPortion = getPreferredHouseholdPortion(detail, food.name);
    const portions = getPortionOptions(detail, food.name);

    setSelectedFoodDetail(detail);
    setQuantity("1");
    setPortionAmount(String(preferredPortion?.gramWeight ?? detailBasis?.amount ?? parseServingSize(food.servingSize)?.amount ?? 1));
    setAmountUnit(preferredPortion ? "serving" : detailBasis?.unit ?? "serving");
    setSelectedPortionValue(preferredPortion?.value ?? portions[0]?.value ?? "");
    setIsLoadingDetail(false);
    return true;
  }

  async function selectFood(food: Food) {
    const measuredBasis = getMeasuredServingBasis(food);
    const typicalServing = getSearchTypicalServing(food);
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(typicalServing?.gramWeight ?? measuredBasis?.amount ?? parseServingSize(food.servingSize)?.amount ?? 1));
    setAmountUnit(measuredBasis?.unit ?? "serving");
    setDetailError("");

    if (applySavedFoodDetail(food)) return;

    if (!food.isSearchPreview && hasUsableSearchNutrition(food)) {
      setIsLoadingDetail(false);
      return;
    }

    try {
      setIsLoadingDetail(true);
      const detail = await fetchUsdaFoodDetail(food.id);
      const detailFood = getFoodForSelectedPortion(food, detail, undefined, 1);
      const detailBasis = getMeasuredServingBasis(detailFood);
      const preferredPortion = getPreferredHouseholdPortion(detail, detailFood.name);
      const portions = getPortionOptions(detail, detailFood.name);

      setSelectedFood(detailFood);
      setSelectedFoodDetail(detail);
      setQuantity("1");
      setPortionAmount(String(preferredPortion?.gramWeight ?? detailBasis?.amount ?? parseServingSize(detailFood.servingSize)?.amount ?? 1));
      setAmountUnit(preferredPortion ? "serving" : detailBasis?.unit ?? "serving");
      setSelectedPortionValue(preferredPortion?.value ?? portions[0]?.value ?? "");
    } catch {
      setDetailError("Could not load portion details for this food.");
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function selectLocalFood(food: Food) {
    const measuredBasis = getMeasuredServingBasis(food);
    const typicalServing = getSearchTypicalServing(food);
    setSelectedFood(food);
    setSelectedFoodDetail(null);
    setSelectedPortionValue("");
    setPortionAmount(String(typicalServing?.gramWeight ?? measuredBasis?.amount ?? parseServingSize(food.servingSize)?.amount ?? 1));
    setAmountUnit(measuredBasis?.unit ?? "serving");
    setDetailError("");
    setIsLoadingDetail(false);
    applySavedFoodDetail(food);
  }

  function changeAmountUnit(unit: AmountUnit) {
    setAmountUnit(unit);
    if (!selectedFood) return;

    if (unit === "serving") {
      const measuredBasis = getMeasuredServingBasis(selectedFood);
      setPortionAmount(String(measuredBasis?.amount ?? parseServingSize(selectedFood.servingSize)?.amount ?? 1));
    } else {
      setPortionAmount("1");
    }
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

  function openBarcodeScan() {
    setIsBarcodeScanOpen(true);
  }

  function closeBarcodeScan() {
    setIsBarcodeScanOpen(false);
  }

  function saveScannedBarcodeFood(food: Food) {
    setCustomFoods([food, ...customFoods]);
    setIsBarcodeScanOpen(false);
    setActiveAddFoodTab("custom");
    selectLocalFood(food);
  }

  // "Save to My Foods" for USDA results: hidden for built-in/custom foods and recipes,
  // "saved" once the food is already in the custom-foods library.
  const selectedFoodLibraryState: "hidden" | "saveable" | "saved" =
    !selectedFood ||
    selectedFood.isSearchPreview ||
    isLoadingDetail ||
    !selectedFood.dataType ||
    selectedFood.dataType === "local"
      ? "hidden"
      : customFoods.some((food) => food.id === selectedFood.id)
        ? "saved"
        : "saveable";

  function saveSelectedFoodToLibrary() {
    if (!selectedFood || selectedFoodLibraryState !== "saveable") return;

    const savedFood: Food = {
      ...selectedFood,
      isSearchPreview: false,
      savedDetail:
        selectedFood.savedDetail ??
        (selectedFoodDetail ? toStorableFoodDetail(selectedFoodDetail) : undefined),
    };

    setCustomFoods([savedFood, ...customFoods]);
    appendDebugLog("usda-food-saved-to-library", { id: savedFood.id, name: savedFood.name });
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
      const { recognize } = await import("tesseract.js");
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

  function addSelectedFood(qtyOverride?: string) {
    if (!selectedFood || !pendingCategory) return;
    if (selectedFood.isSearchPreview) return;

    const effectiveUnit: AmountUnit = amountUnit;
    const effectiveQuantity = effectiveUnit === "serving" ? qtyOverride ?? quantity : quantity;

    const servings = effectiveUnit === "serving" ? Number(effectiveQuantity) : hasUsableSearchNutrition(selectedFood) ? 1 : Number(effectiveQuantity);
    const amount = Number(portionAmount);
    const measuredBasis = getMeasuredServingBasis(selectedFood);
    const basisAmount =
      measuredBasis && effectiveUnit !== "serving" && Number.isFinite(amount) && amount > 0
        ? convertAmountToBasisUnit(amount, effectiveUnit, measuredBasis.unit, getFoodDensity(selectedFood))
        : null;
    const amountScale =
      selectedFood && effectiveUnit !== "serving" && basisAmount !== null
        ? getScaleFromServingBasis(selectedFood, basisAmount)
        : null;
    const selectedServings = effectiveUnit === "serving" ? servings : 1;
    if (!Number.isFinite(selectedServings) || selectedServings <= 0) return;
    if (effectiveUnit !== "serving" && amountScale === null) return;

    const portionOptions = getPortionOptions(selectedFoodDetail, selectedFood.name);
    const selectedPortion = portionOptions.find((portion) => portion.value === selectedPortionValue);
    const selectedFoodServing = getFoodForSelectedPortion(
      selectedFood,
      selectedFoodDetail,
      effectiveUnit === "serving" ? selectedPortion : undefined,
      effectiveUnit !== "serving" && amountScale !== null
        ? basisAmount ?? amount
        : Number(portionAmount)
    );
    const displayFoodServing = {
      ...selectedFoodServing,
      name: getFoodDisplayName(selectedFoodServing),
      brand: selectedFoodServing.brand ? getBrandDisplayName(selectedFoodServing.brand) : selectedFoodServing.brand,
      // The log stores a flat nutrition snapshot; the USDA portion detail stays on the library copy.
      savedDetail: undefined,
    };
    const servingLabel =
      effectiveUnit === "serving"
        ? selectedPortion
          ? selectedServings === 1
            ? selectedPortion.label
            : `${selectedServings} x ${selectedPortion.label}`
          : selectedServings === 1
          ? selectedFoodServing.servingSize
          : `${selectedServings} x ${selectedFoodServing.servingSize}`
        : `${amount} ${effectiveUnit}`;

    setLog([
      ...log,
      {
        ...displayFoodServing,
        category: pendingCategory,
        quantity: selectedServings,
        amount: effectiveUnit === "serving" ? selectedServings : amount,
        amountUnit: effectiveUnit,
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

  const portionOptions = useMemo(
    () => getPortionOptions(selectedFoodDetail, selectedFood?.name),
    [selectedFoodDetail, selectedFood?.name]
  );
  const selectedPortion = portionOptions.find((portion) => portion.value === selectedPortionValue);
  const rawPortionAmount = Number(portionAmount);
  const rawServingQuantity = Number(quantity);
  const measuredServingBasis = selectedFood ? getMeasuredServingBasis(selectedFood) : null;
  const allowedAmountUnits: AmountUnit[] =
    selectedFood?.measurementType === "liquid"
      ? ["serving", "ml", "cup", "tbsp", "tsp"]
      : selectedFood?.measurementType === "spoonable"
        ? ["serving", "g", "oz", "tbsp", "tsp"]
        : ["serving", "g", "oz"];
  const portionAmountInBasisUnits =
    amountUnit === "serving"
      ? selectedPortion?.gramWeight ?? rawPortionAmount
      : measuredServingBasis && selectedFood && Number.isFinite(rawPortionAmount) && rawPortionAmount > 0
        ? convertAmountToBasisUnit(rawPortionAmount, amountUnit, measuredServingBasis.unit, getFoodDensity(selectedFood))
        : null;
  const hasValidPortionAmount =
    amountUnit === "serving" && selectedPortion
      ? true
      : Number.isFinite(rawPortionAmount) && rawPortionAmount > 0;
  const localPortionScale =
    selectedFood &&
    hasUsableSearchNutrition(selectedFood) &&
    hasValidPortionAmount &&
    portionAmountInBasisUnits !== null
      ? getScaleFromServingBasis(selectedFood, portionAmountInBasisUnits)
      : null;
  const usesLocalPortion = Boolean(selectedFood && hasUsableSearchNutrition(selectedFood));
  const selectedPortionBaseCalories = selectedFood
    ? usesLocalPortion && localPortionScale === null
      ? null
      : localPortionScale !== null
      ? Math.round(selectedFood.calories * localPortionScale)
      : getCaloriesPerServing(selectedFood, selectedFoodDetail, selectedPortion)
    : null;
  const selectedPortionCalories =
    selectedPortionBaseCalories !== null && amountUnit === "serving" && Number.isFinite(rawServingQuantity) && rawServingQuantity > 0
      ? Math.round(selectedPortionBaseCalories * rawServingQuantity)
      : selectedPortionBaseCalories;
  const previewFoodServing = useMemo(() => {
    if (!selectedFood) return null;
    const amountForPortion =
      amountUnit !== "serving" && portionAmountInBasisUnits !== null ? portionAmountInBasisUnits : rawPortionAmount;
    return getFoodForSelectedPortion(
      selectedFood,
      selectedFoodDetail,
      amountUnit === "serving" ? selectedPortion : undefined,
      amountForPortion
    );
  }, [selectedFood, selectedFoodDetail, selectedPortion, amountUnit, portionAmountInBasisUnits, rawPortionAmount]);
  const filteredCustomFoods = useMemo(
    () => customFoods.filter((food) => matchesFoodQuery(food, customQuery)),
    [customFoods, customQuery]
  );
  const filteredRecipes = useMemo(
    () => recipes.filter((recipe) => matchesFoodQuery(recipe, recipeQuery)),
    [recipes, recipeQuery]
  );
  const recipeTotals = useMemo(() => getRecipeTotals(recipeIngredients), [recipeIngredients]);
  const canAddSelectedFood =
    Boolean(selectedFood) &&
    !selectedFood?.isSearchPreview &&
    !isLoadingDetail &&
    (amountUnit === "serving" || (allowedAmountUnits.includes(amountUnit) && selectedPortionCalories !== null)) &&
    (amountUnit !== "serving" || portionOptions.length === 0 || Boolean(selectedPortion));
  const servingBasisText =
    amountUnit === "serving" && selectedPortion?.helperText
      ? selectedPortion.helperText
      : amountUnit === "serving"
      ? `Based on ${measuredServingBasis ? `${measuredServingBasis.amount}${measuredServingBasis.unit}` : selectedFood?.servingSize ?? "serving"}`
      : `Using ${Number.isFinite(rawPortionAmount) && rawPortionAmount > 0 ? rawPortionAmount : ""} ${amountUnit}`.trim();

  return {
    customFoodScanInputRef,
    openAddFood,
    closeAddFood,
    pendingCategory,
    activeAddFoodTab,
    setActiveAddFoodTab,
    modalQuery,
    setModalQuery,
    searchModalFood,
    modalFoodGroups,
    isSearchingFoods,
    searchError,
    searchedQuery,
    usdaSkipped,
    selectedFood,
    setSelectedFood,
    selectedFoodDetail,
    selectedPortion,
    isLoadingDetail,
    selectFood,
    selectLocalFood,
    customQuery,
    setCustomQuery,
    openCustomFoodForm,
    isCustomFormOpen,
    setIsCustomFormOpen,
    isBarcodeScanOpen,
    openBarcodeScan,
    closeBarcodeScan,
    saveScannedBarcodeFood,
    isScanningCustomFood,
    scanCustomFoodLabel,
    customFoodOcrError,
    customFoodOcrText,
    customFoodForm,
    setCustomFoodForm,
    customFoodSaveError,
    createCustomFood,
    filteredCustomFoods,
    recipeQuery,
    setRecipeQuery,
    openRecipeForm,
    isRecipeFormOpen,
    setIsRecipeFormOpen,
    recipeForm,
    setRecipeForm,
    recipeTotals,
    recipeIngredientQuery,
    setRecipeIngredientQuery,
    searchRecipeIngredientFoods,
    isSearchingRecipeIngredients,
    recipeIngredientOptions,
    pendingRecipeIngredient,
    setPendingRecipeIngredient,
    selectRecipeIngredient,
    pendingRecipeIngredientQuantity,
    setPendingRecipeIngredientQuantity,
    confirmRecipeIngredient,
    recipeIngredients,
    updateRecipeIngredientQuantity,
    removeRecipeIngredient,
    createRecipe,
    filteredRecipes,
    detailError,
    servingBasisText,
    amountUnit,
    setAmountUnit,
    changeAmountUnit,
    portionOptions,
    selectedPortionValue,
    setSelectedPortionValue,
    quantity,
    setQuantity,
    portionAmount,
    setPortionAmount,
    allowedAmountUnits,
    selectedPortionCalories,
    previewFoodServing,
    addSelectedFood,
    canAddSelectedFood,
    usdaEnabled,
    toggleUsda,
    selectedFoodLibraryState,
    saveSelectedFoodToLibrary,
  };
}
