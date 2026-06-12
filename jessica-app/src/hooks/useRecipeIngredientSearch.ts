import { useMemo, useState } from "react";
import {
  fetchUsdaFoodDetail,
  getFoodForSelectedPortion,
  matchesFoodQuery,
  searchUsdaFoodsWithSynonyms,
  type Food,
} from "../appSupport";

type UseRecipeIngredientSearchArgs = {
  customFoods: Food[];
  recentFoods: Food[];
};

export function useRecipeIngredientSearch({ customFoods, recentFoods }: UseRecipeIngredientSearchArgs) {
  const [recipeIngredientQuery, setRecipeIngredientQuery] = useState("");
  const [recipeIngredientFoods, setRecipeIngredientFoods] = useState<Food[]>([]);
  const [isSearchingRecipeIngredients, setIsSearchingRecipeIngredients] = useState(false);
  const [pendingRecipeIngredient, setPendingRecipeIngredient] = useState<Food | null>(null);
  const [pendingRecipeIngredientQuantity, setPendingRecipeIngredientQuantity] = useState("1");

  async function selectRecipeIngredient(food: Food) {
    if (!food.isSearchPreview) {
      setPendingRecipeIngredient(food);
      setPendingRecipeIngredientQuantity("1");
      return;
    }

    try {
      const detail = await fetchUsdaFoodDetail(food.id);
      setPendingRecipeIngredient(getFoodForSelectedPortion(food, detail, undefined, 1));
      setPendingRecipeIngredientQuantity("1");
    } catch {
      setPendingRecipeIngredient(null);
    }
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

  const recipeIngredientOptions = useMemo(
    () =>
      [...customFoods, ...recentFoods, ...recipeIngredientFoods].filter((food, index, foods) => {
        return (
          matchesFoodQuery(food, recipeIngredientQuery) &&
          foods.findIndex((candidate) => candidate.id === food.id) === index
        );
      }),
    [customFoods, recentFoods, recipeIngredientFoods, recipeIngredientQuery]
  );

  return {
    recipeIngredientQuery,
    setRecipeIngredientQuery,
    recipeIngredientFoods,
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
  };
}
