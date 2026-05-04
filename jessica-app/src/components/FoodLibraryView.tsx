import type { Dispatch, ReactNode, SetStateAction } from "react";
import {
  getBrandDisplayName,
  getFoodDisplayName,
  getFoodIconUrl,
  getIngredientCalories,
  type CustomFoodForm,
  type Food,
  type FoodLibraryTab,
  type LibrarySelection,
  type Recipe,
  type RecipeForm,
  type RecipeIngredient
} from "../appSupport";

type FoodLibraryViewProps = {
  bottomNav: ReactNode;
  foodLibraryTab: FoodLibraryTab;
  setFoodLibraryTab: Dispatch<SetStateAction<FoodLibraryTab>>;
  libraryQuery: string;
  setLibraryQuery: Dispatch<SetStateAction<string>>;
  librarySelection: LibrarySelection | null;
  setLibrarySelection: Dispatch<SetStateAction<LibrarySelection | null>>;
  cancelLibraryEditing: () => void;
  createLibraryCustomFood: () => void;
  createLibraryRecipe: () => void;
  libraryRecentFoods: Array<Food & { loggedCount?: number; lastLoggedDate?: string }>;
  libraryCustomFoods: Food[];
  libraryRecipes: Recipe[];
  isCreatingLibraryCustomFood: boolean;
  isCreatingLibraryRecipe: boolean;
  editingCustomFoodId: number | null;
  editingRecipeId: number | null;
  editCustomFood: (food: Food) => void;
  deleteCustomFood: (foodId: number) => void;
  libraryCustomFoodForm: CustomFoodForm;
  setLibraryCustomFoodForm: Dispatch<SetStateAction<CustomFoodForm>>;
  saveNewLibraryCustomFood: () => void;
  saveLibraryCustomFood: () => void;
  editRecipe: (recipe: Recipe) => void;
  deleteRecipe: (recipeId: number) => void;
  libraryRecipeForm: RecipeForm;
  setLibraryRecipeForm: Dispatch<SetStateAction<RecipeForm>>;
  recipeIngredientQuery: string;
  setRecipeIngredientQuery: Dispatch<SetStateAction<string>>;
  searchRecipeIngredientFoods: () => void;
  recipeIngredientOptions: Food[];
  pendingRecipeIngredient: Food | null;
  selectRecipeIngredient: (food: Food) => void | Promise<void>;
  isSearchingRecipeIngredients: boolean;
  pendingRecipeIngredientQuantity: string;
  setPendingRecipeIngredientQuantity: Dispatch<SetStateAction<string>>;
  confirmLibraryRecipeIngredient: () => void;
  setPendingRecipeIngredient: Dispatch<SetStateAction<Food | null>>;
  libraryRecipeIngredients: RecipeIngredient[];
  updateLibraryRecipeIngredientQuantity: (foodId: number, quantity: string) => void;
  removeLibraryRecipeIngredient: (foodId: number) => void;
  saveNewLibraryRecipe: () => void;
  saveLibraryRecipe: () => void;
};

export function FoodLibraryView({
  bottomNav,
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
  selectRecipeIngredient,
  isSearchingRecipeIngredients,
  pendingRecipeIngredientQuantity,
  setPendingRecipeIngredientQuantity,
  confirmLibraryRecipeIngredient,
  setPendingRecipeIngredient,
  libraryRecipeIngredients,
  updateLibraryRecipeIngredientQuantity,
  removeLibraryRecipeIngredient,
  saveNewLibraryRecipe,
  saveLibraryRecipe
}: FoodLibraryViewProps) {
  return (
    <main className="app">
    
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
                        <span className="food-card-title">
                          <img src={getFoodIconUrl(food)} alt="" />
                          <strong>{food.name}</strong>
                        </span>
                        <span className="food-card-meta-row">
                          <span className="food-card-brand">{getBrandDisplayName(food.brand)}</span>
                          <span className="food-card-cal">{food.calories} cal per {food.servingSize}</span>
                        </span>
                        <span className="food-card-logged">Logged {food.loggedCount ?? 0} times this week</span>
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
                        <span className="food-card-title">
                          <img src={getFoodIconUrl(food)} alt="" />
                          <strong>{food.name}</strong>
                        </span>
                        <span className="food-card-meta-row">
                          <span className="food-card-brand">{getBrandDisplayName(food.brand)}</span>
                          <span className="food-card-cal">{food.calories} cal per {food.servingSize}</span>
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
                        <span className="food-card-title">
                          <img src={getFoodIconUrl(recipe)} alt="" />
                          <strong>{recipe.name}</strong>
                        </span>
                        <span className="food-card-meta-row">
                          <span className="food-card-brand">{recipe.ingredients.length} ingredients</span>
                          <span className="food-card-cal">{recipe.calories} cal per {recipe.servingSize}</span>
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
                    <div className="library-detail-heading">
                      <img src={getFoodIconUrl(librarySelection.food)} alt="" />
                      <h2>{librarySelection.food.name}</h2>
                    </div>
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
