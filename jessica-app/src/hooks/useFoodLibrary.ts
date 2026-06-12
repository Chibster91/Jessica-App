import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  emptyCustomFoodForm,
  emptyRecipeForm,
  matchesFoodQuery,
  foodToCustomFoodForm,
  recipeToRecipeForm,
  parseCustomFood,
  parseRecipe,
  type CustomFoodForm,
  type Food,
  type FoodLibraryTab,
  type LibrarySelection,
  type Recipe,
  type RecipeForm,
  type RecipeIngredient,
} from "../appSupport";
import { useRecipeIngredientSearch } from "./useRecipeIngredientSearch";

type RecentFood = Food & { loggedCount: number; lastLoggedDate: string };

type UseFoodLibraryArgs = {
  customFoods: Food[];
  setCustomFoods: Dispatch<SetStateAction<Food[]>>;
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  recentFoods: RecentFood[];
};

export function useFoodLibrary({
  customFoods,
  setCustomFoods,
  recipes,
  setRecipes,
  recentFoods,
}: UseFoodLibraryArgs) {
  const [foodLibraryTab, setFoodLibraryTab] = useState<FoodLibraryTab>("recent");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySelection, setLibrarySelection] = useState<LibrarySelection | null>(null);
  const [editingCustomFoodId, setEditingCustomFoodId] = useState<number | null>(null);
  const [editingRecipeId, setEditingRecipeId] = useState<number | null>(null);
  const [isCreatingLibraryCustomFood, setIsCreatingLibraryCustomFood] = useState(false);
  const [isCreatingLibraryRecipe, setIsCreatingLibraryRecipe] = useState(false);
  const [libraryCustomFoodForm, setLibraryCustomFoodForm] =
    useState<CustomFoodForm>(emptyCustomFoodForm);
  const [libraryRecipeForm, setLibraryRecipeForm] = useState<RecipeForm>(emptyRecipeForm);
  const [libraryRecipeIngredients, setLibraryRecipeIngredients] = useState<RecipeIngredient[]>([]);

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

  const libraryRecentFoods = useMemo(
    () => recentFoods.filter((food) => matchesFoodQuery(food, libraryQuery)),
    [recentFoods, libraryQuery]
  );
  const libraryCustomFoods = useMemo(
    () => customFoods.filter((food) => matchesFoodQuery(food, libraryQuery)),
    [customFoods, libraryQuery]
  );
  const libraryRecipes = useMemo(
    () => recipes.filter((recipe) => matchesFoodQuery(recipe, libraryQuery)),
    [recipes, libraryQuery]
  );

  return {
    foodLibraryTab,
    setFoodLibraryTab,
    libraryQuery,
    setLibraryQuery,
    librarySelection,
    setLibrarySelection,
    cancelLibraryEditing,
    createLibraryCustomFood,
    createLibraryRecipe,
    libraryRecentFoods,
    libraryCustomFoods,
    libraryRecipes,
    isCreatingLibraryCustomFood,
    isCreatingLibraryRecipe,
    editingCustomFoodId,
    editingRecipeId,
    editCustomFood,
    deleteCustomFood,
    libraryCustomFoodForm,
    setLibraryCustomFoodForm,
    saveNewLibraryCustomFood,
    saveLibraryCustomFood,
    editRecipe,
    deleteRecipe,
    libraryRecipeForm,
    setLibraryRecipeForm,
    recipeIngredientQuery,
    setRecipeIngredientQuery,
    searchRecipeIngredientFoods,
    recipeIngredientOptions,
    pendingRecipeIngredient,
    setPendingRecipeIngredient,
    selectRecipeIngredient,
    isSearchingRecipeIngredients,
    pendingRecipeIngredientQuantity,
    setPendingRecipeIngredientQuantity,
    confirmLibraryRecipeIngredient,
    libraryRecipeIngredients,
    updateLibraryRecipeIngredientQuantity,
    removeLibraryRecipeIngredient,
    saveNewLibraryRecipe,
    saveLibraryRecipe,
  };
}
