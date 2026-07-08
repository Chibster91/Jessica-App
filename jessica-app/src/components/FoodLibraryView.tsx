import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import "../styles/library.css";
import {
  applyTypicalServing,
  createClientId,
  getBrandDisplayName,
  getFoodDisplayName,
  getFoodIconUrl,
  getFoodServingDisplay,
  getIngredientCalories,
  getAllLocalFoods,
  matchesLocalFoodQuery,
  mealCategories,
  type Food,
  type LogItem,
  type MealCategory,
  type Recipe,
} from "../appSupport";
import { useFoodLibrary } from "../hooks/useFoodLibrary";
import { NutritionSheet, Sheet } from "./Overlays";
import {
  LibraryManualEntry,
  LibraryBarcodeScan,
  LibraryUrlImport,
  LibraryPhotoImport,
} from "./LibraryAddScreens";

type NutritionPreview = { food: Food | Recipe; quantity: number };

type RecentFood = Food & { loggedCount: number; lastLoggedDate: string };

type FoodLibraryViewProps = {
  bottomNav: ReactNode;
  customFoods: Food[];
  setCustomFoods: Dispatch<SetStateAction<Food[]>>;
  recipes: Recipe[];
  setRecipes: Dispatch<SetStateAction<Recipe[]>>;
  recentFoods: RecentFood[];
  log: LogItem[];
  setLog: Dispatch<SetStateAction<LogItem[]>>;
};

export function FoodLibraryView({
  bottomNav,
  customFoods,
  setCustomFoods,
  recipes,
  setRecipes,
  recentFoods,
  log,
  setLog,
}: FoodLibraryViewProps) {
  type AddScreen = "scan" | "manual-food" | "manual-recipe" | "url-import" | "photo-import" | "recipe-menu";
  const [addScreen, setAddScreen] = useState<AddScreen | null>(null);
  const [nutritionPreview, setNutritionPreview] = useState<NutritionPreview | null>(null);
  function addFoodToToday(food: Food | Recipe, category: MealCategory, qty: string) {
    const quantity = parseFloat(qty) || 1;
    setLog([
      ...log,
      {
        ...food,
        category,
        quantity,
        amount: quantity,
        amountUnit: "serving",
        servingLabel: quantity === 1 ? food.servingSize : `${quantity} x ${food.servingSize}`,
        logId: createClientId(),
        // The log stores a flat nutrition snapshot; the saved portion detail stays on the library copy.
        savedDetail: undefined,
      },
    ]);
  }

  const {
    foodLibraryTab,
    setFoodLibraryTab,
    libraryQuery,
    setLibraryQuery,
    librarySelection,
    setLibrarySelection,
    cancelLibraryEditing,
    libraryRecentFoods,
    libraryCustomFoods,
    libraryRecipes,
    isCreatingLibraryCustomFood,
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
    selectRecipeIngredient,
    isSearchingRecipeIngredients,
    pendingRecipeIngredientQuantity,
    setPendingRecipeIngredientQuantity,
    confirmLibraryRecipeIngredient,
    setPendingRecipeIngredient,
    libraryRecipeIngredients,
    updateLibraryRecipeIngredientQuantity,
    removeLibraryRecipeIngredient,
    saveLibraryRecipe,
  } = useFoodLibrary({ customFoods, setCustomFoods, recipes, setRecipes, recentFoods });

  const [dbFoods, setDbFoods] = useState<Food[]>([]);
  useEffect(() => { getAllLocalFoods().then(setDbFoods); }, []);
  const dbFoodsByCategory = useMemo(() => {
    const filtered = libraryQuery
      ? dbFoods.filter(f => matchesLocalFoodQuery(f.name, f.category ?? "", libraryQuery))
      : dbFoods;
    const map = new Map<string, Food[]>();
    for (const food of filtered) {
      const cat = food.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(food);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cat, foods]) => ({
        cat,
        foods: [...foods].sort((a, b) => getFoodDisplayName(a).localeCompare(getFoodDisplayName(b))),
      }));
  }, [dbFoods, libraryQuery]);

  return (
    <main className="app">
      <div className="lib-screen">
        <div className="health-tabs" role="tablist" aria-label="Food library sections">
          <button
            className={foodLibraryTab === "recent" ? "active" : ""}
            type="button"
            onClick={() => { setFoodLibraryTab("recent"); setLibrarySelection(null); cancelLibraryEditing(); }}
            role="tab" aria-selected={foodLibraryTab === "recent"}
          >Recent</button>
          <button
            className={foodLibraryTab === "custom" ? "active" : ""}
            type="button"
            onClick={() => { setFoodLibraryTab("custom"); setLibrarySelection(null); cancelLibraryEditing(); }}
            role="tab" aria-selected={foodLibraryTab === "custom"}
          >Custom</button>
          <button
            className={foodLibraryTab === "recipes" ? "active" : ""}
            type="button"
            onClick={() => { setFoodLibraryTab("recipes"); setLibrarySelection(null); cancelLibraryEditing(); }}
            role="tab" aria-selected={foodLibraryTab === "recipes"}
          >Recipes</button>
          <button
            className={foodLibraryTab === "database" ? "active" : ""}
            type="button"
            onClick={() => { setFoodLibraryTab("database"); setLibrarySelection(null); cancelLibraryEditing(); }}
            role="tab" aria-selected={foodLibraryTab === "database"}
          >Database</button>
        </div>

        <div className="lib-search-row">
          <input
            className="library-search"
            value={libraryQuery}
            placeholder={`Search ${foodLibraryTab}...`}
            onChange={(e) => setLibraryQuery(e.target.value)}
          />
        </div>

        <div className="library-list">
          {foodLibraryTab === "custom" && (
            <button type="button" className="lib-addrow" onClick={() => setAddScreen("scan")}>
              <span className="lib-addrow-plus">+</span>
              <span className="lib-addrow-main">
                <strong>New food</strong>
                <span>Scan a barcode or enter manually</span>
              </span>
              <span className="lib-addrow-chev">›</span>
            </button>
          )}
          {foodLibraryTab === "recipes" && (
            <button type="button" className="lib-addrow" onClick={() => setAddScreen("recipe-menu")}>
              <span className="lib-addrow-plus">+</span>
              <span className="lib-addrow-main">
                <strong>New recipe</strong>
                <span>Enter manually, or import from a URL or screenshot</span>
              </span>
              <span className="lib-addrow-chev">›</span>
            </button>
          )}

          {foodLibraryTab === "recent" && libraryRecentFoods.length === 0 && (
            <p className="empty-meal">No recent foods match this search.</p>
          )}
          {foodLibraryTab === "recent" && libraryRecentFoods.map((food) => (
            <button
              className={`lib-foodrow${librarySelection?.food.id === food.id ? " selected" : ""}`}
              key={food.id} type="button"
              onClick={() => { setLibrarySelection({ type: "recent", food }); setNutritionPreview({ food, quantity: 1 }); }}
            >
              <span className="lib-foodrow-icon"><img src={getFoodIconUrl(food)} alt="" /></span>
              <span className="lib-foodrow-main">
                <span className="lib-foodrow-name">{food.name}</span>
                <span className="lib-foodrow-meta">
                  {getBrandDisplayName(food.brand)}{getBrandDisplayName(food.brand) ? " · " : ""}{food.loggedCount ?? 0}× this week
                </span>
              </span>
              <span className="lib-foodrow-cal">{food.calories}<small>cal</small></span>
            </button>
          ))}

          {foodLibraryTab === "custom" && libraryCustomFoods.length === 0 && (
            <p className="empty-meal">No custom foods match this search.</p>
          )}
          {foodLibraryTab === "custom" && libraryCustomFoods.map((food) => (
            <button
              className={`lib-foodrow${librarySelection?.food.id === food.id ? " selected" : ""}`}
              key={food.id} type="button"
              onClick={() => { setLibrarySelection({ type: "custom", food }); setNutritionPreview({ food, quantity: 1 }); }}
            >
              <span className="lib-foodrow-icon"><img src={getFoodIconUrl(food)} alt="" /></span>
              <span className="lib-foodrow-main">
                <span className="lib-foodrow-name">{food.name}</span>
                <span className="lib-foodrow-meta">
                  {getBrandDisplayName(food.brand) || "Custom"} · {getFoodServingDisplay(food)}
                </span>
              </span>
              <span className="lib-foodrow-cal">{food.calories}<small>cal</small></span>
            </button>
          ))}

          {foodLibraryTab === "recipes" && libraryRecipes.length === 0 && (
            <p className="empty-meal">No recipes match this search.</p>
          )}
          {foodLibraryTab === "recipes" && libraryRecipes.map((recipe) => (
            <button
              className={`lib-foodrow${librarySelection?.food.id === recipe.id ? " selected" : ""}`}
              key={recipe.id} type="button"
              onClick={() => { setLibrarySelection({ type: "recipe", food: recipe }); setNutritionPreview({ food: recipe, quantity: 1 }); }}
            >
              <span className="lib-foodrow-icon"><img src={getFoodIconUrl(recipe)} alt="" /></span>
              <span className="lib-foodrow-main">
                <span className="lib-foodrow-name">{recipe.name}</span>
                <span className="lib-foodrow-meta">{recipe.ingredients.length} ingredients · {getFoodServingDisplay(recipe)}</span>
              </span>
              <span className="lib-foodrow-cal">{recipe.calories}<small>cal</small></span>
            </button>
          ))}

          {foodLibraryTab === "database" && dbFoodsByCategory.length === 0 && (
            <p className="empty-meal">{dbFoods.length === 0 ? "Loading…" : "No foods match this search."}</p>
          )}
          {foodLibraryTab === "database" && dbFoodsByCategory.map(({ cat, foods }) => (
            <div key={cat} className="lib-db-group">
              <div className="lib-db-category-header">{cat}</div>
              {foods.map(food => {
                const servingFood = applyTypicalServing(food);
                return (
                  <button
                    className={`lib-foodrow${nutritionPreview?.food.id === food.id ? " selected" : ""}`}
                    key={food.id} type="button"
                    onClick={() => setNutritionPreview({ food: servingFood, quantity: 1 })}
                  >
                    <span className="lib-foodrow-icon"><img src={getFoodIconUrl(food)} alt="" /></span>
                    <span className="lib-foodrow-main">
                      <span className="lib-foodrow-name">{getFoodDisplayName(food)}</span>
                      <span className="lib-foodrow-meta">{cat} · {getFoodServingDisplay(servingFood)}</span>
                    </span>
                    <span className="lib-foodrow-cal">{servingFood.calories}<small>cal</small></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <aside className="library-detail">
                {!librarySelection && !isCreatingLibraryCustomFood && (
                  <p className="empty-meal">Select a food to view details.</p>
                )}

                {librarySelection && librarySelection.type !== "recipe" && (
                  <>
                    <div className="library-detail-heading">
                      <img src={getFoodIconUrl(librarySelection.food)} alt="" />
                      <h2>{librarySelection.food.name}</h2>
                    </div>
                    <p>{getBrandDisplayName(librarySelection.food.brand)}</p>
                    <button
                      type="button"
                      className="lib-view-nutrition"
                      onClick={() => setNutritionPreview({ food: librarySelection.food, quantity: 1 })}
                    >
                      View nutrition · {librarySelection.food.calories} cal per {getFoodServingDisplay(librarySelection.food)}
                    </button>
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
    
        </aside>
      </div>

      {addScreen === "scan" && (
        <LibraryBarcodeScan
          onSaveFood={(food) => { setCustomFoods((prev) => [food, ...prev]); setAddScreen(null); }}
          onClose={() => setAddScreen(null)}
          onBack={() => setAddScreen(null)}
          onManual={() => setAddScreen("manual-food")}
        />
      )}
      {addScreen === "manual-food" && (
        <LibraryManualEntry
          kind="food"
          onSaveFood={(food) => { setCustomFoods((prev) => [food, ...prev]); setAddScreen(null); }}
          onSaveRecipe={() => {}}
          onClose={() => setAddScreen(null)}
          onBack={() => setAddScreen(null)}
        />
      )}
      {addScreen === "recipe-menu" && (
        <div className="kit-addfood">
          <div className="kit-addfood__top">
            <div className="kit-addfood__bar">
              <div className="kit-addfood__bar-left">
                <button className="kit-icon-btn" aria-label="Back" onClick={() => setAddScreen(null)}>‹</button>
                <span className="kit-addfood__title">New recipe</span>
              </div>
              <button className="kit-icon-btn kit-icon-btn--ghost" aria-label="Close" onClick={() => setAddScreen(null)}>×</button>
            </div>
          </div>
          <div className="library-list" style={{ padding: "0.5rem 0" }}>
            <button type="button" className="lib-addrow lib-addrow--plain" onClick={() => setAddScreen("manual-recipe")}>
              <span className="lib-addrow-main">
                <strong>Enter manually</strong>
                <span>Type in the name and nutrition yourself</span>
              </span>
              <span className="lib-addrow-chev">›</span>
            </button>
            <button type="button" className="lib-addrow lib-addrow--plain" onClick={() => setAddScreen("photo-import")}>
              <span className="lib-addrow-main">
                <strong>Import from screenshot</strong>
                <span>Read a recipe photo on your device</span>
              </span>
              <span className="lib-addrow-chev">›</span>
            </button>
            <button type="button" className="lib-addrow lib-addrow--plain" onClick={() => setAddScreen("url-import")}>
              <span className="lib-addrow-main">
                <strong>Import from URL</strong>
                <span>Paste a link to a recipe page</span>
              </span>
              <span className="lib-addrow-chev">›</span>
            </button>
          </div>
        </div>
      )}
      {addScreen === "manual-recipe" && (
        <LibraryManualEntry
          kind="recipe"
          onSaveFood={() => {}}
          onSaveRecipe={(recipe) => { setRecipes((prev) => [recipe, ...prev]); setAddScreen(null); }}
          onClose={() => setAddScreen(null)}
          onBack={() => setAddScreen("recipe-menu")}
        />
      )}
      {addScreen === "url-import" && (
        <LibraryUrlImport
          onSaveRecipe={(recipe) => { setRecipes((prev) => [recipe, ...prev]); setAddScreen(null); }}
          onClose={() => setAddScreen(null)}
          onBack={() => setAddScreen("recipe-menu")}
        />
      )}
      {addScreen === "photo-import" && (
        <LibraryPhotoImport
          customFoods={customFoods}
          onSaveRecipe={(recipe) => { setRecipes((prev) => [recipe, ...prev]); setAddScreen(null); }}
          onClose={() => setAddScreen(null)}
          onBack={() => setAddScreen("recipe-menu")}
        />
      )}

      {nutritionPreview && (() => {
        // A real recipe has an ingredients array; branded packaged foods carry an
        // `ingredients` *string* (the label's ingredient list), so test the type,
        // not just the key's presence.
        const isRecipePreview = Array.isArray((nutritionPreview.food as Recipe).ingredients);
        return (
          <NutritionSheet
            key={nutritionPreview.food.id}
            food={{
              name: getFoodDisplayName(nutritionPreview.food),
              calories: nutritionPreview.food.calories,
              serving: getFoodServingDisplay(nutritionPreview.food),
              protein: nutritionPreview.food.protein,
              carbs: nutritionPreview.food.carbs,
              fat: nutritionPreview.food.fat,
            }}
            mode="view"
            initialQuantity={String(nutritionPreview.quantity)}
            ingredients={
              isRecipePreview && (nutritionPreview.food as Recipe).ingredients.length > 0
                ? (nutritionPreview.food as Recipe).ingredients.map((ingredient) => ({
                    key: ingredient.food.id,
                    name: ingredient.food.name,
                    quantityLabel: `x ${ingredient.quantity}`,
                    calories: getIngredientCalories(ingredient),
                    onClick: () => setNutritionPreview({ food: ingredient.food, quantity: ingredient.quantity }),
                  }))
                : undefined
            }
            mealPicker={{
              categories: mealCategories,
              onAdd: (category, qty) => {
                addFoodToToday(nutritionPreview.food, category, qty);
                setNutritionPreview(null);
              },
            }}
            actions={
              isRecipePreview
                ? [
                    {
                      label: "Edit recipe",
                      onClick: () => {
                        editRecipe(nutritionPreview.food as Recipe);
                        setNutritionPreview(null);
                      },
                    },
                    {
                      label: "Delete recipe",
                      danger: true,
                      onClick: () => {
                        deleteRecipe(nutritionPreview.food.id);
                        setNutritionPreview(null);
                      },
                    },
                  ]
                : undefined
            }
            onClose={() => setNutritionPreview(null)}
          />
        );
      })()}

      {editingRecipeId !== null && (
        <Sheet
          title="Edit Recipe"
          onClose={cancelLibraryEditing}
          footer={
            <div className="kit-view-actions">
              <button type="button" className="kit-btn kit-btn--primary" onClick={saveLibraryRecipe}>
                Save
              </button>
              <button type="button" className="kit-btn kit-btn--secondary" onClick={cancelLibraryEditing}>
                Cancel
              </button>
            </div>
          }
        >
          <div className="custom-food-form">
            <label>
              Recipe name
              <input
                value={libraryRecipeForm.name}
                onChange={(e) => setLibraryRecipeForm({ ...libraryRecipeForm, name: e.target.value })}
              />
            </label>
            <label>
              Serving size
              <input
                value={libraryRecipeForm.servingSize}
                onChange={(e) => setLibraryRecipeForm({ ...libraryRecipeForm, servingSize: e.target.value })}
              />
            </label>
            <label>
              Serving unit
              <input
                value={libraryRecipeForm.servingUnit}
                onChange={(e) => setLibraryRecipeForm({ ...libraryRecipeForm, servingUnit: e.target.value })}
              />
            </label>
            <label>
              Notes
              <textarea
                value={libraryRecipeForm.notes}
                onChange={(e) => setLibraryRecipeForm({ ...libraryRecipeForm, notes: e.target.value })}
              />
            </label>
          </div>

          <div className="search-row">
            <input
              value={recipeIngredientQuery}
              placeholder="Search packaged and custom foods..."
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
                    {food.isSearchPreview ? "Select to load nutrition" : `${food.calories} cal per ${food.servingSize}`}
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
                  {pendingRecipeIngredient.calories} cal per {pendingRecipeIngredient.servingSize}
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
                  onChange={(e) => updateLibraryRecipeIngredientQuantity(ingredient.food.id, e.target.value)}
                />
                <span>{getIngredientCalories(ingredient)} cal</span>
                <button type="button" onClick={() => removeLibraryRecipeIngredient(ingredient.food.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {bottomNav}
    </main>
  );
}
