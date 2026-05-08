import { type CSSProperties, type ReactNode } from "react";
import {
  mealCategories,
  formatEntryDate,
  formatShortDate,
  formatMacro,
  getFoodDisplayName,
  getFoodServingDisplay,
  getFoodIconUrl,
  getModalResultCalories,
  getFoodSearchCalorieDisplay,
  getBrandDisplayName,
  getIngredientCalories,
  type AmountUnit,
  type FoodLogImportDraft
} from "../appSupport";
import "../styles/log.css";

type LogViewProps = Record<string, any> & {
  bottomNav: ReactNode;
  importErrors: string[];
  importDrafts: FoodLogImportDraft[];
  visibleMealCategories: string[];
  log: any[];
  modalFoods: any[];
  recentFoods: any[];
  filteredCustomFoods: any[];
  recipeIngredientOptions: any[];
  recipeIngredients: any[];
  filteredRecipes: any[];
  portionOptions: Array<{ value: string; label: string; gramWeight: number }>;
  allowedAmountUnits: AmountUnit[];
  importSteps: ImportStep[];
  importWeightEntries: Array<{ id: string; date: string; weightLb: number }>;
  driveImportFiles: Array<{ id: string; name: string; modifiedTime?: string; size?: string | number }>;
  setIsLogMenuOpen: (value: boolean | ((current: boolean) => boolean)) => void;
  getEditAmountUnits: (item: any) => AmountUnit[];
};
type ImportStep = {
  date: string;
  items: FoodLogImportDraft[];
  weightEntry: { weightLb: number } | null;
};

export function LogView(props: LogViewProps) {
  const {
    goals, totalCalories, dailyTotals, completedDays, selectedDate, moveSelectedDate, changeSelectedDate, importStatus, importErrors, importDrafts, isLogMenuOpen, setIsLogMenuOpen, setIsImportDayOpen, setExportStatus, setIsExportPanelOpen, visibleMealCategories, getCategoryTotals, scrollToMeal, log, expandedMeals, mealCardRefs, toggleMeal, mealMenuCategory, setMealMenuCategory, openSaveMealAsRecipe, setMealToDelete, suppressNextClickRef, openEditFoodItem, setContextMenuItem, setContextMenuY, longPressRef, getItemCalories, logTapProbe, openAddFood, handleFinishToggle, pendingCategory, tapProbeProps, activeAddFoodTab, setActiveAddFoodTab, modalQuery, setModalQuery, searchModalFood, modalFoods, selectedFood, selectedFoodDetail, selectedPortion, isLoadingDetail, selectFood, recentFoods, selectLocalFood, customQuery, setCustomQuery, openCustomFoodForm, isCustomFormOpen, customFoodScanInputRef, isScanningCustomFood, scanCustomFoodLabel, customFoodOcrError, customFoodOcrText, customFoodForm, setCustomFoodForm, customFoodSaveError, createCustomFood, setIsCustomFormOpen, filteredCustomFoods, recipeQuery, setRecipeQuery, openRecipeForm, isRecipeFormOpen, recipeForm, setRecipeForm, recipeTotals, recipeIngredientQuery, setRecipeIngredientQuery, searchRecipeIngredientFoods, isSearchingRecipeIngredients, recipeIngredientOptions, pendingRecipeIngredient, selectRecipeIngredient, pendingRecipeIngredientQuantity, setPendingRecipeIngredientQuantity, confirmRecipeIngredient, setPendingRecipeIngredient, recipeIngredients, updateRecipeIngredientQuantity, removeRecipeIngredient, createRecipe, setIsRecipeFormOpen, filteredRecipes, closeAddFood, detailError, servingBasisText, amountUnit, portionOptions, selectedPortionValue, setSelectedPortionValue, quantity, setQuantity, portionAmount, setPortionAmount, setAmountUnit, allowedAmountUnits, selectedPortionCalories, addSelectedFood, canAddSelectedFood, setSelectedFood, importSteps, importStepIndex, cancelImportStepper, confirmImportStep, skipImportStep, importStepResults, closeImportSummary, importFileName, importWeightEntries, updateImportDraft, removeImportDraft, removeImportWeightEntry, confirmFoodLogImport, importReviewItems, importReviewSelections, importReviewAppliedSelections, importReviewActions, importReviewRememberedRows, importReviewManualTarget, importReviewManualQuery, setImportReviewManualQuery, importReviewManualGroups, isImportReviewManualSearching, unresolvedImportReviewIds, importResolutionProgress, updateImportReviewSelection, applyImportReviewToSimilar, rejectImportReviewItem, openImportReviewManualSearch, closeImportReviewManualSearch, searchImportReviewManualFoods, selectImportReviewManualFood, confirmImportReview, isResolvingImport, clearFoodDebugData, closeImportPreview, isExportPanelOpen, googleDriveClientId, isUploadingToDrive, setGoogleDriveClientId, exportStatus, exportDriveLink, downloadDayExport, uploadDayExportToDrive, isImportDayOpen, openDriveImport, isLoadingDriveImport, openImportFilePicker, isDriveImportOpen, setIsDriveImportOpen, driveImportStatus, driveImportFiles, importGoogleDriveFile, mealToSaveAsRecipe, mealRecipeName, setMealRecipeName, saveMealAsRecipe, setMealToSaveAsRecipe, mealToDelete, confirmDeleteMeal, itemToEdit, editItemAmountUnit, editItemAmount, setEditItemAmount, setEditItemAmountUnit, getEditAmountUnits, saveEditedFoodItem, setItemToEdit, itemToRemove, confirmRemoveFood, setItemToRemove, contextMenuItem, contextMenuY, moveToMealItem, setMoveToMealItem, moveItemToMeal, moveToDayItem, setMoveToDayItem, setMoveToDayDate, setMoveToDayStep, moveToDayStep, moveToDayDate, moveItemToDifferentDay, bottomNav
  } = props;
  const sortedRecentFoods = [...recentFoods].sort((a, b) => {
    const dateCompare = String(b.lastLoggedDate ?? "").localeCompare(String(a.lastLoggedDate ?? ""));
    if (dateCompare !== 0) return dateCompare;
    return (b.loggedCount ?? 0) - (a.loggedCount ?? 0);
  });
  const sortedCustomFoods = [...filteredCustomFoods].sort((a, b) =>
    getFoodDisplayName(a).localeCompare(getFoodDisplayName(b))
  );
  const sortedRecipes = [...filteredRecipes].sort((a, b) =>
    getFoodDisplayName(a).localeCompare(getFoodDisplayName(b))
  );
  const visibleRecentFoods = sortedRecentFoods.filter((food) => {
    const query = modalQuery.trim().toLowerCase();
    if (!query) return true;
    return `${getFoodDisplayName(food)} ${getBrandDisplayName(food.brand)}`.toLowerCase().includes(query);
  });
  const addFoodSearchValue =
    activeAddFoodTab === "custom" ? customQuery :
    activeAddFoodTab === "recipes" ? recipeQuery :
    modalQuery;
  const addFoodSearchPlaceholder =
    activeAddFoodTab === "custom" ? "Search custom foods..." :
    activeAddFoodTab === "recipes" ? "Search recipes..." :
    activeAddFoodTab === "recent" ? "Search recent foods..." :
    "Search all foods...";
  function updateAddFoodSearch(value: string) {
    if (activeAddFoodTab === "custom") {
      setCustomQuery(value);
      return;
    }
    if (activeAddFoodTab === "recipes") {
      setRecipeQuery(value);
      return;
    }
    setModalQuery(value);
  }
  function submitAddFoodSearch() {
    if (activeAddFoodTab === "search") searchModalFood();
  }

  const importReviewDateGroups: any[] = importReviewItems.reduce((dateGroups: any[], review: any) => {
    let dateGroup = dateGroups.find((group) => group.date === review.item.date);
    if (!dateGroup) {
      dateGroup = { date: review.item.date, meals: [] };
      dateGroups.push(dateGroup);
    }

    const mealName = review.item.meal || "Meal";
    let mealGroup = dateGroup.meals.find((group: any) => group.meal === mealName);
    if (!mealGroup) {
      mealGroup = { meal: mealName, reviews: [] };
      dateGroup.meals.push(mealGroup);
    }
    mealGroup.reviews.push(review);
    return dateGroups;
  }, []);

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

            {importStatus && <p className="import-inline-status">{importStatus}</p>}
            {importErrors.length > 0 && importDrafts.length === 0 && (
              <div className="import-inline-errors" role="alert">
                {importErrors.slice(0, 3).map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <section className="log-summary-card">
              <button
                type="button"
                className="log-menu-button"
                aria-label="Log options"
                onClick={() => setIsLogMenuOpen((v) => !v)}
              >
                ⋯
              </button>
              {isLogMenuOpen && (
                <>
                  <div className="log-menu-backdrop" onClick={() => setIsLogMenuOpen(false)} />
                  <div className="log-menu-dropdown">
                    <button
                      type="button"
                      onClick={() => { setIsLogMenuOpen(false); setIsImportDayOpen(true); }}
                    >
                      Import
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsLogMenuOpen(false); setExportStatus(""); setIsExportPanelOpen(true); }}
                    >
                      Export
                    </button>
                    <button
                      type="button"
                      className="danger-menu-item"
                      onClick={() => { setIsLogMenuOpen(false); clearFoodDebugData(); }}
                    >
                      Debug clear food data
                    </button>
                  </div>
                </>
              )}
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
                        <>
                          <div className="meal-menu-backdrop" onClick={() => setMealMenuCategory(null)} />
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
                        </>
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
                              setContextMenuItem(item);
                              setContextMenuY(e.clientY);
                            }}
                            onPointerDown={(e) => {
                              if (longPressRef.current) clearTimeout(longPressRef.current.timer);
                              const y = e.clientY;
                              longPressRef.current = {
                                logId: item.logId,
                                timer: setTimeout(() => {
                                  longPressRef.current = null;
                                  suppressNextClickRef.current = item.logId;
                                  setContextMenuItem(item);
                                  setContextMenuY(y);
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
                              <span>{getFoodServingDisplay(item)}</span>
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
              <div className={`finish-toggle${isDayLogged ? " logged" : ""}`} role="switch" aria-checked={isDayLogged} aria-label="Finish logging" onClick={handleFinishToggle}>
                <span className="finish-toggle-indicator" />
                <button type="button" aria-label="Mark day unfinished" />
                <button type="button" aria-label="Finish logging" />
              </div>
            </div>
          </section>
        );
      })()}

      {pendingCategory && (
        <section className="add-food-screen" aria-labelledby="meal-category-title" {...tapProbeProps("add-food-modal")}>
          <div className="add-food-top">
            <h2 id="meal-category-title" className="add-food-title">Add to {pendingCategory}</h2>
            <button type="button" className="add-food-close" onClick={closeAddFood} aria-label="Close add food">
              ×
            </button>
            <div className="add-food-search-row">
              <input
                value={addFoodSearchValue}
                placeholder={addFoodSearchPlaceholder}
                onChange={(e) => updateAddFoodSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAddFoodSearch()}
              />
              {activeAddFoodTab === "search" && (
                <button type="button" onClick={searchModalFood}>Search</button>
              )}
            </div>
          </div>

          <div className="add-food-content">
            <div className="add-food-tabs" role="tablist" aria-label="Add food source">
              <button
                className={`add-food-tab${activeAddFoodTab === "search" ? " is-active" : ""}`}
                type="button"
                onClick={() => setActiveAddFoodTab("search")}
                role="tab"
                aria-selected={activeAddFoodTab === "search"}
              >
                All
              </button>
              <button
                className={`add-food-tab${activeAddFoodTab === "recent" ? " is-active" : ""}`}
                type="button"
                onClick={() => setActiveAddFoodTab("recent")}
                role="tab"
                aria-selected={activeAddFoodTab === "recent"}
              >
                Recent
              </button>
              <button
                className={`add-food-tab${activeAddFoodTab === "custom" ? " is-active" : ""}`}
                type="button"
                onClick={() => setActiveAddFoodTab("custom")}
                role="tab"
                aria-selected={activeAddFoodTab === "custom"}
              >
                Custom
              </button>
              <button
                className={`add-food-tab${activeAddFoodTab === "recipes" ? " is-active" : ""}`}
                type="button"
                onClick={() => setActiveAddFoodTab("recipes")}
                role="tab"
                aria-selected={activeAddFoodTab === "recipes"}
              >
                Recipes
              </button>
            </div>

            {activeAddFoodTab === "search" && (
              <div className="modal-results add-food-results">
                  {modalFoods.length === 0 && (
                    <p className="empty-meal">Search for foods from USDA, local foods, custom foods, recipes, and recent logs.</p>
                  )}
                  {modalFoods.map((food) => {
                    const resultDisplay = getModalResultCalories(
                      food,
                      selectedFood,
                      selectedFoodDetail,
                      selectedPortion,
                      isLoadingDetail
                    );
                    const calorieDisplay = getFoodSearchCalorieDisplay(
                      food,
                      resultDisplay.calories,
                      resultDisplay.servingSize
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
                        <span className="food-card-meta-row">
                          <span className="food-card-brand">
                            {food.brand ? getBrandDisplayName(food.brand) : (food.dataType ?? "USDA")}
                          </span>
                          <span className="food-card-cal">
                            {resultDisplay.isLoading
                              ? "Loading..."
                              : food.isSearchPreview && selectedFood?.id !== food.id
                                ? resultDisplay.servingSize
                                : `${calorieDisplay.calories} cal per ${calorieDisplay.serving}`}
                          </span>
                        </span>
                      </button>
                    );
                  })}
              </div>
            )}

            {activeAddFoodTab === "recent" && (
              <div className="modal-results add-food-results">
                {visibleRecentFoods.length === 0 && (
                  <p className="empty-meal">No recent foods logged in the last week.</p>
                )}

                {visibleRecentFoods.map((food) => (
                  <button
                    className={`food-card ${selectedFood?.id === food.id ? "selected" : ""}`}
                    key={food.id}
                    onClick={() => selectLocalFood(food)}
                  >
                    <span className="food-card-title">
                      <img src={getFoodIconUrl(food)} alt="" />
                      <strong>{food.name}</strong>
                    </span>
                    <span className="food-card-meta-row">
                      <span className="food-card-brand">{getBrandDisplayName(food.brand)}</span>
                      <span className="food-card-cal">{food.calories} cal per {food.servingSize}</span>
                    </span>
                    <span className="food-card-logged">Logged {food.loggedCount} times this week</span>
                  </button>
                ))}
              </div>
            )}

            {activeAddFoodTab === "custom" && (
              <>
                <div className="add-food-tab-action">
                  <button
                    type="button"
                    onPointerDown={(event) => logTapProbe("open-custom-food-form", "pointerdown", event)}
                    onTouchStart={(event) => logTapProbe("open-custom-food-form", "touchstart", event)}
                    onClick={(event) => {
                      logTapProbe("open-custom-food-form", "click", event);
                      openCustomFoodForm();
                    }}
                  >
                    Add Custom Food
                  </button>
                </div>

                {isCustomFormOpen && (
                  <div className="floating-overlay custom-food-form-overlay" role="presentation" onClick={() => setIsCustomFormOpen(false)}>
                    <div className="floating-popover custom-food-form-popover" role="dialog" aria-modal="true" aria-labelledby="custom-food-form-title" onClick={(e) => e.stopPropagation()}>
                      <h2 id="custom-food-form-title">Add custom food</h2>
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
                    </div>
                  </div>
                )}

                <div className="modal-results add-food-results">
                    {sortedCustomFoods.length === 0 && (
                      <p className="empty-meal">No custom foods match this search.</p>
                    )}

                    {sortedCustomFoods.map((food) => (
                      <button
                        className={`food-card ${selectedFood?.id === food.id ? "selected" : ""}`}
                        key={food.id}
                        onClick={() => selectLocalFood(food)}
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
                </div>
              </>
            )}

            {activeAddFoodTab === "recipes" && (
              <>
                <div className="add-food-tab-action">
                  <button type="button" onClick={openRecipeForm}>
                    Add Recipe
                  </button>
                </div>

                {isRecipeFormOpen && (
                  <div className="floating-overlay recipe-form-overlay" role="presentation" onClick={() => setIsRecipeFormOpen(false)}>
                    <div className="floating-popover recipe-form-popover" role="dialog" aria-modal="true" aria-labelledby="recipe-form-title" onClick={(e) => e.stopPropagation()}>
                      <h2 id="recipe-form-title">Add recipe</h2>
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
                                  <span className="food-card-meta-row">
                                    <span className="food-card-brand">
                                      {food.brand ? getBrandDisplayName(food.brand) : (food.dataType ?? "USDA")}
                                    </span>
                                    <span className="food-card-cal">
                                      {food.isSearchPreview ? "Select to load nutrition" : `${food.calories} cal per ${food.servingSize}`}
                                    </span>
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
                    </div>
                  </div>
                )}

                <div className="modal-results add-food-results">
                    {sortedRecipes.length === 0 && (
                      <p className="empty-meal">No recipes match this search.</p>
                    )}

                    {sortedRecipes.map((recipe) => (
                      <button
                        className={`food-card ${selectedFood?.id === recipe.id ? "selected" : ""}`}
                        key={recipe.id}
                        onClick={() => selectLocalFood(recipe)}
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
              </>
            )}

          </div>
        </section>
      )}

      {pendingCategory && selectedFood && !isCustomFormOpen && !isRecipeFormOpen && (
        <div className="floating-overlay serving-overlay" role="presentation">
          <div className="floating-popover serving-popover" role="dialog" aria-modal="true" aria-labelledby="serving-popup-title">
            <h2 id="serving-popup-title">{getFoodDisplayName(selectedFood)}</h2>
            {isLoadingDetail && <p className="scan-status">Loading portions...</p>}
            {detailError && <p className="modal-error">{detailError}</p>}

            <p className="serving-basis-text">
              {servingBasisText}
            </p>

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

<div className="amount-row">
  <label className="floating-field amount-field">
    {amountUnit === "serving" ? "Servings" : "Amount"}
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

  <label className="floating-field unit-field">
    Unit
    <select
      value={amountUnit}
      onChange={(e) => setAmountUnit(e.target.value as AmountUnit)}
    >
      {allowedAmountUnits.map((unit) => (
        <option key={unit} value={unit}>
          {unit}
        </option>
      ))}
    </select>
  </label>
</div>

            {selectedPortionCalories !== null && (
              <p className="modal-hint">
                {selectedPortionCalories.toLocaleString()} cal for this amount
              </p>
            )}

            <div className="floating-actions">
              <button className="primary-button" type="button" onClick={addSelectedFood} disabled={!canAddSelectedFood}>
                Add Food
              </button>
              {selectedFood.id > 0 && (
                <a
                  className="secondary-button"
                  href={`https://fdc.nal.usda.gov/food-details/${selectedFood.id}/nutrients`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on USDA
                </a>
              )}
              <button className="secondary-button" type="button" onClick={() => setSelectedFood(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {importReviewItems.length === 0 && !isResolvingImport && importSteps.length > 0 && importStepIndex < importSteps.length && (() => {
        const step = importSteps[importStepIndex];
        const mealGroups = step.items.reduce<{ meal: string; items: FoodLogImportDraft[] }[]>((acc, item) => {
          const group = acc.find((g) => g.meal === item.meal);
          if (group) group.items.push(item);
          else acc.push({ meal: item.meal, items: [item] });
          return acc;
        }, []);
        const progressPct = (importStepIndex / importSteps.length) * 100;
        return (
          <div className="floating-overlay import-preview-overlay" role="presentation">
            <div className="floating-popover import-step-popover" role="dialog" aria-modal="true" aria-labelledby="import-step-title">
              <div className="import-preview-header">
                <div>
                  <h2 id="import-step-title">Import Food Log</h2>
                  <p className="import-step-progress-label">Day {importStepIndex + 1} of {importSteps.length}</p>
                </div>
                <button type="button" onClick={cancelImportStepper} aria-label="Close import">×</button>
              </div>

              <div className="import-step-progress-bar" aria-hidden="true">
                <div className="import-step-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="import-step-date-row">
                <strong>{formatEntryDate(step.date)}</strong>
                {step.weightEntry && (
                  <span className="import-step-weight-badge">⚖ {step.weightEntry.weightLb} lb</span>
                )}
              </div>

              {step.items.length > 0 ? (
                <div className="import-step-meals">
                  {mealGroups.map(({ meal, items: mealItems }) => (
                    <div key={meal} className="import-step-meal-group">
                      <p className="import-step-meal-name">{meal}</p>
                      {mealItems.map((item) => (
                        <div key={item.id} className="import-step-food-row">
                          <span className="import-step-food-name">{item.name}</span>
                          <span className="import-step-food-serving">{item.serving}</span>
                          <span className="import-step-food-cal">{item.calories} cal</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="import-step-empty">No food items — weight only.</p>
              )}

              <div className="floating-actions">
                <button type="button" className="primary-button" onClick={confirmImportStep} disabled={isResolvingImport}>
                  {isResolvingImport ? "Resolving..." : "Confirm Day"}
                </button>
                <button type="button" className="secondary-button" style={{ marginTop: 0 }} onClick={skipImportStep}>
                  Skip Day
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {importReviewItems.length === 0 && !isResolvingImport && importSteps.length > 0 && importStepIndex >= importSteps.length && (
        <div className="floating-overlay" role="presentation">
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="import-summary-title">
            <h2 id="import-summary-title">Import Complete</h2>
            <p>
              {importStepResults.confirmed > 0
                ? `${importStepResults.confirmed} day${importStepResults.confirmed === 1 ? "" : "s"} imported`
                : "No days imported"}
              {importStepResults.skipped > 0 && `, ${importStepResults.skipped} skipped`}.
            </p>
            <button type="button" className="primary-button" onClick={closeImportSummary}>
              Done
            </button>
          </div>
        </div>
      )}

      {isResolvingImport && importReviewItems.length === 0 && importDrafts.length > 0 && (
        <div className="floating-overlay import-preview-overlay" role="presentation">
          <div className="floating-popover confirm-modal import-resolving-popover" role="dialog" aria-modal="true" aria-labelledby="import-resolving-title">
            <h2 id="import-resolving-title">Review Matches</h2>
            <p>
              {importResolutionProgress
                ? `Resolving ${importResolutionProgress.resolved}/${importResolutionProgress.total} foods...`
                : `Resolving ${importDrafts.length} foods...`}
            </p>
            <div className="import-step-progress-bar" aria-hidden="true">
              <div
                className="import-step-progress-fill"
                style={{
                  width: `${importResolutionProgress && importResolutionProgress.total > 0
                    ? Math.round((importResolutionProgress.resolved / importResolutionProgress.total) * 100)
                    : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {importReviewItems.length > 0 && (
        <div className="floating-overlay import-preview-overlay" role="presentation">
          <div className="floating-popover import-review-popover" role="dialog" aria-modal="true" aria-labelledby="import-review-title">
            <div className="import-preview-header">
              <div>
                <h2 id="import-review-title">Review Matches</h2>
                <p>
                  {importFileName || "JSON import"} · {importReviewItems.length} food item{importReviewItems.length === 1 ? "" : "s"}
                  {importWeightEntries.length > 0 && ` · ${importWeightEntries.length} weight entr${importWeightEntries.length === 1 ? "y" : "ies"}`}
                </p>
              </div>
              <button type="button" onClick={closeImportPreview} aria-label="Close import review">
                ×
              </button>
            </div>

            {importErrors.length > 0 && (
              <div className="import-preview-errors" role="alert">
                {importErrors.map((error: string) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            )}

            <div className="import-review-list">
              {importReviewDateGroups.map((dateGroup: any) => (
                <section className="import-review-day" key={dateGroup.date}>
                  <div className="import-review-day-header">
                    <strong>{formatEntryDate(dateGroup.date)}</strong>
                    <span>{dateGroup.meals.reduce((count: number, meal: any) => count + meal.reviews.length, 0)} foods</span>
                  </div>
                  {dateGroup.meals.map((mealGroup: any) => (
                    <div className="import-review-meal" key={`${dateGroup.date}-${mealGroup.meal}`}>
                      <p className="import-review-meal-name">{mealGroup.meal}</p>
                      {mealGroup.reviews.map((review: any) => {
                        const selectedMatch = importReviewSelections[review.item.id] ?? review.candidates[0]?.key ?? "new";
                        const action = importReviewActions[review.item.id];
                        const isApplied = action === "applied" && importReviewAppliedSelections[review.item.id] === selectedMatch;
                        const isRejected = action === "rejected";
                        const isUnresolved = unresolvedImportReviewIds.includes(review.item.id);

                        return (
                          <div
                            className={`import-review-row${isApplied ? " is-applied" : ""}${isRejected ? " is-rejected" : ""}${isUnresolved ? " is-unresolved" : ""}`}
                            key={review.item.id}
                          >
                            <div className="import-review-main">
                              <div className="import-review-imported">
                                <strong>{review.item.name}</strong>
                                <span>
                                  {review.item.calories} cal · P {review.item.protein || "0"}g / C {review.item.carbs || "0"}g / F {review.item.fat || "0"}g
                                </span>
                                <span>{review.item.serving && `${review.item.serving} · `}{review.item.quantity || "1"} serving{review.item.quantity === "1" ? "" : "s"}</span>
                              </div>
                              <label className="import-review-match">
                                Match
                                <div className="import-review-match-control">
                                  <select
                                    value={selectedMatch}
                                    onChange={(event) => updateImportReviewSelection(review.item.id, event.target.value)}
                                  >
                                    {review.candidates.map((candidate: any) => (
                                      <option key={candidate.key} value={candidate.key}>
                                        {candidate.food.name} · {candidate.sourceLabel} · {candidate.food.servingSize} · {candidate.food.calories} cal · P {Number(candidate.food.protein.toFixed(1))} / C {Number(candidate.food.carbs.toFixed(1))} / F {Number(candidate.food.fat.toFixed(1))} · {candidate.confidence}
                                      </option>
                                    ))}
                                    <option value="new">Create as new custom food</option>
                                  </select>
                                  <button
                                    type="button"
                                    className="import-review-search-button"
                                    aria-label={`Search override for ${review.item.name}`}
                                    onClick={() => openImportReviewManualSearch(review.item)}
                                  >
                                    ⌕
                                  </button>
                                </div>
                              </label>
                              <div className="import-review-meta">
                                {importReviewRememberedRows[review.item.id] && (
                                  <span className="import-review-remembered-label">Matched from earlier selection</span>
                                )}
                                {review.candidates.length > 0 ? review.candidates.slice(0, 3).map((candidate: any) => (
                                  <span key={candidate.key}>
                                    {candidate.sourceLabel}: {candidate.nameSimilarity}% · {candidate.confidence}
                                  </span>
                                )) : <span>No existing matches found.</span>}
                              </div>
                            </div>
                            <div className="import-review-actions">
                              <button
                                type="button"
                                className={`secondary-button${isApplied ? " is-applied" : ""}`}
                                aria-pressed={isApplied}
                                onClick={() => applyImportReviewToSimilar(review.item)}
                              >
                                {isApplied ? "Applied" : "Apply"}
                              </button>
                              <button
                                type="button"
                                className={`secondary-button danger-menu-item${isRejected ? " is-rejected" : ""}`}
                                aria-pressed={isRejected}
                                onClick={() => rejectImportReviewItem(review.item)}
                              >
                                {isRejected ? "Rejected" : "Reject"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </section>
              ))}
            </div>

            <div className="floating-actions">
              <button type="button" className="primary-button" onClick={confirmImportReview} disabled={isResolvingImport}>
                {isResolvingImport ? "Resolving..." : "Confirm Changes"}
              </button>
              <button type="button" className="secondary-button" onClick={closeImportPreview}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {importReviewManualTarget && (
        <div className="floating-overlay import-preview-overlay" role="presentation">
          <div className="floating-popover import-manual-search-popover" role="dialog" aria-modal="true" aria-labelledby="import-manual-search-title">
            <div className="import-preview-header">
              <div>
                <h2 id="import-manual-search-title">Find Match</h2>
                <p>{importReviewManualTarget.name}</p>
              </div>
              <button type="button" onClick={closeImportReviewManualSearch} aria-label="Close manual match search">
                ×
              </button>
            </div>

            <form
              className="import-manual-search-bar"
              onSubmit={(event) => {
                event.preventDefault();
                searchImportReviewManualFoods();
              }}
            >
              <input
                value={importReviewManualQuery}
                placeholder="Search foods..."
                onChange={(event) => setImportReviewManualQuery(event.target.value)}
              />
              <button type="submit" className="primary-button" disabled={isImportReviewManualSearching}>
                {isImportReviewManualSearching ? "Searching..." : "Search"}
              </button>
            </form>

            <div className="import-manual-results">
              {importReviewManualGroups.length === 0 && (
                <p className="empty-meal">Search local foods, custom foods, recipes, and USDA foods.</p>
              )}
              {importReviewManualGroups.map((group: any) => (
                <section className="import-manual-result-group" key={group.label}>
                  <h3>{group.label}</h3>
                  {group.foods.map((food: any) => (
                    <button
                      type="button"
                      className="import-manual-result-row"
                      key={`${group.label}-${food.id}`}
                      onClick={() => selectImportReviewManualFood(food)}
                    >
                      <span>
                        <strong>{getFoodDisplayName(food)}</strong>
                        {food.brand && <small>{getBrandDisplayName(food.brand)}</small>}
                      </span>
                      <span>{food.servingSize} · {food.calories} cal</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>

            <div className="floating-actions">
              <button type="button" className="secondary-button" onClick={closeImportReviewManualSearch}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {!isResolvingImport && importReviewItems.length === 0 && (importDrafts.length > 0 || importWeightEntries.length > 0) && (
        <div className="floating-overlay import-preview-overlay" role="presentation">
          <div className="floating-popover import-preview-popover" role="dialog" aria-modal="true" aria-labelledby="import-preview-title">
            <div className="import-preview-header">
              <div>
                <h2 id="import-preview-title">Import Food Log</h2>
                <p>
                  {importFileName || "JSON import"}
                  {importDrafts.length > 0 && ` · ${importDrafts.length} food item${importDrafts.length === 1 ? "" : "s"}`}
                  {importWeightEntries.length > 0 && ` · ${importWeightEntries.length} weight entr${importWeightEntries.length === 1 ? "y" : "ies"}`}
                </p>
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
                    Brand
                    <input
                      value={item.brand}
                      onChange={(event) => updateImportDraft(item.id, { brand: event.target.value })}
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
                    Servings
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(event) => updateImportDraft(item.id, { quantity: event.target.value })}
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
              {importWeightEntries.length > 0 && (
                <div className="import-weight-section">
                  <h3>Weight Entries</h3>
                  {importWeightEntries.map((entry) => (
                    <div className="import-weight-row" key={entry.id}>
                      <span className="import-weight-date">{entry.date}</span>
                      <span className="import-weight-value">{entry.weightLb} lb</span>
                      <button type="button" className="danger-button" onClick={() => removeImportWeightEntry(entry.id)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="floating-actions">
              <button type="button" className="primary-button" onClick={confirmFoodLogImport} disabled={isResolvingImport}>
                {isResolvingImport ? "Resolving..." : "Add Items"}
              </button>
              <button type="button" className="secondary-button" onClick={closeImportPreview}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isExportPanelOpen && (
        <div className="floating-overlay" role="presentation" onClick={() => setIsExportPanelOpen(false)}>
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="export-day-title" onClick={(e) => e.stopPropagation()}>
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
                Local Download
              </button>
              <button type="button" onClick={uploadDayExportToDrive} disabled={isUploadingToDrive}>
                {isUploadingToDrive ? "Uploading..." : "Export to Drive"}
              </button>
            </div>
            <button type="button" className="secondary-button" onClick={() => setIsExportPanelOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {isImportDayOpen && (
        <div className="floating-overlay" role="presentation" onClick={() => setIsImportDayOpen(false)}>
          <div className="floating-popover confirm-modal" role="dialog" aria-modal="true" aria-labelledby="import-day-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="import-day-title">Import Day</h2>
            <p>Load a food log from a saved JSON file.</p>
            <div className="floating-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => { setIsImportDayOpen(false); openDriveImport(); }}
                disabled={isLoadingDriveImport}
              >
                {isLoadingDriveImport ? "Loading..." : "Import from Drive"}
              </button>
              <button
                type="button"
                onClick={() => { setIsImportDayOpen(false); openImportFilePicker(); }}
              >
                Import from File
              </button>
            </div>
            <button type="button" className="secondary-button" onClick={() => setIsImportDayOpen(false)}>
              Cancel
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
            <div className="amount-row">
              <label className="floating-field amount-field">
                {editItemAmountUnit === "serving" ? "Servings" : "Amount"}
                <input
                  type="text"
                  inputMode="decimal"
                  value={editItemAmount}
                  onChange={(e) => setEditItemAmount(e.target.value)}
                />
              </label>
              <label className="floating-field unit-field">
                Unit
                <select
                  value={editItemAmountUnit}
                  onChange={(e) => setEditItemAmountUnit(e.target.value as AmountUnit)}
                >
                  {getEditAmountUnits(itemToEdit).map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="modal-hint">
              Current: {getFoodServingDisplay(itemToEdit)}
            </p>
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

      {contextMenuItem && (
        <div
          className="food-ctx-overlay"
          role="presentation"
          onClick={() => setContextMenuItem(null)}
        >
          <div
            className="food-ctx-menu"
            style={{ top: Math.max(8, Math.min(contextMenuY - 10, window.innerHeight - 170)) }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                setMoveToMealItem(contextMenuItem);
                setContextMenuItem(null);
              }}
            >
              Move to Different Meal
            </button>
            <button
              type="button"
              onClick={() => {
                setMoveToDayItem(contextMenuItem);
                setMoveToDayDate(selectedDate);
                setMoveToDayStep("date");
                setContextMenuItem(null);
              }}
            >
              Move to Different Day
            </button>
            <button
              type="button"
              className="danger-menu-item"
              onClick={() => {
                setItemToRemove(contextMenuItem);
                setContextMenuItem(null);
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {moveToMealItem && (
        <div
          className="floating-overlay"
          role="presentation"
          onClick={() => setMoveToMealItem(null)}
        >
          <div
            className="floating-popover"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Move to Meal</h2>
            <p>Move <strong>{getFoodDisplayName(moveToMealItem)}</strong> to:</p>
            <div className="food-ctx-meal-options">
              {visibleMealCategories
                .filter((cat) => cat !== moveToMealItem.category)
                .map((cat) => (
                  <button key={cat} type="button" onClick={() => moveItemToMeal(moveToMealItem, cat)}>
                    {cat}
                  </button>
                ))}
            </div>
            <button type="button" className="secondary-button" onClick={() => setMoveToMealItem(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {moveToDayItem && (
        <div
          className="floating-overlay"
          role="presentation"
          onClick={() => { setMoveToDayItem(null); setMoveToDayStep("date"); }}
        >
          <div
            className="floating-popover"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {moveToDayStep === "date" ? (
              <>
                <h2>Move to Different Day</h2>
                <p>Choose a date for <strong>{getFoodDisplayName(moveToDayItem)}</strong></p>
                <input
                  type="date"
                  className="floating-date-input"
                  value={moveToDayDate}
                  onChange={(e) => setMoveToDayDate(e.target.value)}
                />
                <div className="floating-actions">
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!moveToDayDate}
                    onClick={() => setMoveToDayStep("meal")}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ marginTop: 0 }}
                    onClick={() => { setMoveToDayItem(null); setMoveToDayStep("date"); }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Choose Meal</h2>
                <p>Add to which meal on <strong>{formatShortDate(moveToDayDate)}</strong>?</p>
                <div className="food-ctx-meal-options">
                  {mealCategories.map((cat) => (
                    <button key={cat} type="button" onClick={() => moveItemToDifferentDay(moveToDayItem, moveToDayDate, cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
                <button type="button" className="secondary-button" onClick={() => setMoveToDayStep("date")}>
                  ← Back
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {!pendingCategory && bottomNav}
    </main>
  );

}
