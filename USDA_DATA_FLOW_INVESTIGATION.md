# USDA / FoodData Central Data Flow Investigation

## Executive Summary

The app retrieves USDA / FoodData Central data through a production Cloudflare Worker at `https://jessica-worker.snack-bunker.workers.dev`, not directly from the browser. The frontend has two USDA search entry points:

- General add-food search: `App.searchModalFood()` calls `searchFoodsGrouped()`, which always searches custom foods, recipes, recent foods, the local `foods.json` database, and USDA packaged foods.
- Recipe ingredient search: `App.searchRecipeIngredientFoods()` calls `searchUsdaFoodsWithSynonyms()`, which checks the local `foods.json` database first and only calls USDA when local results are sparse.

USDA search results initially come back as lightweight preview foods with `servingSize: "Details required"`, zero nutrients, and `isSearchPreview: true`. Full nutrition, portions, household serving text, and label nutrients are only loaded when a user selects a USDA preview food. That detail lookup is cached in-memory in both the frontend and the worker.

Ranking happens twice. The worker expands a query into multiple FoodData Central search requests, ranks raw USDA search rows, dedupes by `fdcId`, and returns up to 15 preview foods. The frontend then optionally expands the query with local brand synonyms, merges local/custom/recent/recipe/USDA data, and re-ranks each group with `getFoodSearchScore()`.

The app now has a display-layer portion derivation in `appSupport.ts` that can prefer USDA household servings such as `1 slice = 32 g`, but only after a detail lookup. Preview cards still show `select to load nutrition` until detail is loaded.

The weakest areas are:

- Raw USDA descriptions still drive identity and matching, then are only cosmetically title-cased for display.
- Add-food grouped results are flattened before rendering, so group labels are not shown even though the search function computes them.
- Import matching only uses USDA foods from the grouped search's `Packaged` group and only searches by imported item name, not brand, serving, macros, or richer phrase variants.
- Import candidate filters can reject valid matches before ranking if token similarity, core-food compatibility, or prepared-food specificity checks fail.
- Remembered import matches are stored only in component state for the current import review session, not persisted for future imports.

## File / Function Map

### Frontend Core

`jessica-app/src/App.tsx`

- `searchModalFood()`: triggered from the add-food search tab. Calls `searchFoodsGrouped(modalQuery, customFoods, getRecentFoods(selectedDate), recipes)`.
- `selectFood(food)`: selects a USDA preview or regular food. If the food is a USDA preview or lacks usable loaded nutrition, calls `fetchUsdaFoodDetail(food.id)`.
- `selectLocalFood(food)`: selects already-loaded local/custom/recent/recipe foods without USDA detail lookup.
- `searchRecipeIngredientFoods()`: searches recipe ingredients with `searchUsdaFoodsWithSynonyms(recipeIngredientQuery)`.
- `selectRecipeIngredient(food)`: if a recipe ingredient is a USDA preview, calls `fetchUsdaFoodDetail(food.id)` and converts detail into a full `Food`.
- `addSelectedFood()`: saves the selected food into the current day log.
- `buildImportFoodBatchResolver()`: builds candidates for imported food rows and optionally searches USDA.
- `getUsdaImportCandidates(query)`: calls `searchFoodsGrouped(query, [], [], [])` and keeps only the `Packaged` group for import matching.
- `confirmImportReview()`, `applyImportReviewToSimilar()`, `selectImportReviewManualFood()`: resolve import review decisions and remembered matches.

`jessica-app/src/appSupport.ts`

- Types:
  - `Food`
  - `FoodDetail`
  - `FoodPortion`
  - `PortionOption`
  - `SearchResultGroup`
  - `FoodLogImportDraft`
  - `LogItem`
- USDA fetch:
  - `fetchUsdaFoods(query)`
  - `fetchUsdaFoodDetail(foodId)`
  - `searchUsdaFoodsWithSynonyms(query)`
  - `searchFoodsGrouped(query, customFoods, recentFoods, recipes)`
- Local database search:
  - `getLocalFoods()`
  - `localFoodToFood(entry)`
  - `searchLocalFoods(query)`
  - `getAllLocalFoods()`
- Ranking:
  - `normalizeSearchText(value)`
  - `getSearchTokens(value)`
  - `getSearchSynonyms(query)`
  - `getFoodSearchScore(food, query)`
  - `rankSearchResults(foods, query)`
- Display:
  - `formatDisplayName(name)`
  - `getFoodDisplayName(food)`
  - `getBrandDisplayName(brand)`
  - `getFoodServingDisplay(food)`
  - `getFoodSearchServingDisplay(food, servingSize)`
  - `getFoodSearchCalorieDisplay(food, calories, servingSize)`
  - `getModalResultCalories(...)`
- Detail nutrition and portions:
  - `getPortionLabel(portion, foodName)`
  - `getPreferredHouseholdPortion(detail, foodName)`
  - `getPortionOptions(detail, foodName)`
  - `getServingSizeBasis(detail, food)`
  - `getServingSizeLabel(detail, food)`
  - `getCaloriesPerServing(food, detail, portion)`
  - `getFoodForSelectedPortion(food, detail, portion, amount)`
- Storage helpers:
  - `getSavedLog(date)`
  - `getSavedCustomFoods()`
  - `saveCustomFoods(foods)`
  - `getRecentFoods(selectedDate)`
  - `saveTopFoods(foods)`

`jessica-app/src/components/LogView.tsx`

- Renders:
  - Add-food search result cards.
  - Recent/custom/recipe cards.
  - USDA detail serving modal.
  - Import match review modal.
  - Import manual search modal.
- Uses:
  - `getFoodDisplayName()`
  - `getBrandDisplayName()`
  - `getFoodSearchCalorieDisplay()`
  - `getModalResultCalories()`
  - `getFoodServingDisplay()`

`jessica-app/src/components/FoodLibraryView.tsx`

- Renders saved recent/custom/recipe library data.
- Uses `getFoodDisplayName()`, `getBrandDisplayName()`, and `getFoodServingDisplay()`.
- Does not directly query USDA.

### Worker

`jessica-worker/src/index.ts`

- `fetch(request, env)`: route entry point.
  - `GET /?query=...` performs USDA search.
  - `GET /detail?id=...` performs USDA detail lookup.
- `searchUsdaFoods(request, apiKey)`: calls FoodData Central `/v1/foods/search`.
- `handleDetail(url, env)`: calls FoodData Central `/v1/food/{fdcId}` and maps raw detail into the frontend detail shape.
- `expandSearchRequests(query)`: builds one or more USDA search requests.
- `getKnownBrandMatch(queryText)`: hard-coded brand detection for special branded searches.
- `addLikelyProductCategory(queryText)`: adds `coffee creamer` for creamer-like queries.
- `rankSearchResult(food, query)`: worker-side USDA preview ranking.
- `isExperimentalFood(food)`: excludes experimental and survey data.
- `getServingSizeText(food)`, `getHouseholdServingText(food)`, `normalizeFoodPortions(portions)`: detail serving normalization.

`jessica-worker/src/fdc-types.ts`

- Type models for FoodData Central search/detail payloads:
  - `FdcSearchResultFood`
  - `FdcSearchResponse`
  - `FdcFoodDetail`
  - `FdcFoodPortion`
  - `FdcLabelNutrients`
  - `FdcFoodNutrient`

## Primary Data Shapes

### Frontend `Food`

Defined in `jessica-app/src/appSupport.ts`.

```ts
type Food = {
  id: number;
  name: string;
  brand: string | null;
  category?: string | null;
  measurementType?: "solid" | "liquid" | "spoonable";
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
  isSearchPreview?: boolean;
  amount?: number;
  amountUnit?: AmountUnit;
  portionLabel?: string;
  portionScale?: number;
  servingLabel?: string;
};
```

USDA search preview example:

```ts
{
  id: 123456,
  name: "BREAD, WHITE, SLICED",
  brand: "Example Bakery",
  category: "Baked Products",
  dataType: "Branded",
  servingSize: "Details required",
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  isSearchPreview: true
}
```

Loaded USDA food example after detail:

```ts
{
  id: 123456,
  name: "BREAD, WHITE, SLICED",
  brand: "Example Bakery",
  category: "Baked Products",
  dataType: "Branded",
  servingSize: "slice (32 g)",
  calories: 80,
  protein: 3,
  carbs: 15,
  fat: 1,
  sodium: 150,
  isSearchPreview: false
}
```

### Frontend `FoodDetail`

Defined in `jessica-app/src/appSupport.ts`; returned by the worker detail endpoint.

Important fields:

```ts
type FoodDetail = {
  id?: number;
  name?: string;
  brand?: string | null;
  category?: string | null;
  dataType?: string | null;
  publicationDate?: string | null;
  ingredients?: string | null;
  gtinUpc?: string | null;
  servingSize?: string | null;
  servingSizeValue?: number | null;
  servingSizeUnit?: string | null;
  householdServingFullText?: string | null;
  labelNutrients?: { calories?: { value?: number | null } | null; ... } | null;
  foodPortions?: FoodPortion[];
  foodNutrients?: FoodNutrient[];
  nutrients?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    fiber?: number;
    sugars?: number;
    sodium?: number;
  };
};
```

### Worker Search Result `WorkerFood`

Defined in `jessica-worker/src/index.ts`.

```ts
export type WorkerFood = {
  id: number;
  name: string;
  brand: string | null;
  category: string | null;
  ingredients: string | null;
  dataType: string | undefined;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  isSearchPreview?: boolean;
};
```

## Data Flow Diagram

```text
User types in add-food search
  -> LogView search input
  -> App.searchModalFood()
  -> appSupport.searchFoodsGrouped(query, customFoods, recentFoods, recipes)
       -> custom foods and recipes filtered locally
       -> recent foods filtered locally
       -> appSupport.searchLocalFoods(query)
            -> fetch /Jessica-App/foods.json
            -> localFoodToFood()
            -> rankSearchResults()
       -> appSupport.fetchUsdaFoods(query and synonyms)
            -> GET https://jessica-worker.snack-bunker.workers.dev/?query=...
            -> worker.expandSearchRequests()
            -> USDA GET /v1/foods/search
            -> worker filters, ranks, maps to preview WorkerFood
       -> frontend dedupes and ranks USDA packaged results
       -> returns groups: My Foods, Whole Foods, Packaged
  -> App flattens groups into modalFoods
  -> LogView renders cards
  -> User selects USDA preview
  -> App.selectFood()
       -> appSupport.fetchUsdaFoodDetail(food.id)
            -> GET https://jessica-worker.snack-bunker.workers.dev/detail?id=...
            -> worker GET /v1/food/{fdcId}
            -> worker maps serving, portions, label nutrients, nutrients
       -> appSupport.getFoodForSelectedPortion()
       -> appSupport.getPreferredHouseholdPortion()
       -> App sets selectedFood, selectedFoodDetail, selectedPortionValue
  -> LogView renders serving modal
  -> User adds food
  -> App.addSelectedFood()
       -> stores LogItem in state
       -> useEffect persists to localStorage key log-YYYY-MM-DD
```

Import flow:

```text
User imports JSON
  -> appSupport.parseFoodLogImportJson()
  -> App.buildImportFoodBatchResolver()
       -> build temporary Food from imported row
       -> index local foods, custom foods, recipes
       -> rank local/custom/recipe candidates
       -> if best base candidate exists and is not generic:
            use base candidates only
          else:
            App.getUsdaImportCandidates(imported item name)
              -> searchFoodsGrouped(name, [], [], [])
              -> keep only Packaged group
            rank USDA candidates together with base candidates
       -> create review items or resolver entries
  -> LogView import review modal
  -> User applies/rejects/manual-searches
  -> App.applyImportedFoods()
       -> new imported custom foods have negative IDs
       -> USDA/local/custom/recipe matches keep candidate food IDs
       -> logs saved to localStorage
       -> newly created import foods saved to customFoods
```

## 1. Where USDA Searches Are Triggered

### Add-food search

User action:

- Open a meal's add-food modal.
- Enter text in the add-food search input.
- Submit the search, likely by pressing Enter or clicking the search control wired to `searchModalFood`.

Code path:

- `LogView.submitAddFoodSearch()` calls the `searchModalFood` prop when `activeAddFoodTab === "search"`.
- `App.searchModalFood()` calls:

```ts
searchFoodsGrouped(modalQuery, customFoods, getRecentFoods(selectedDate), recipes)
```

Then `App.searchModalFood()` flattens all groups into `modalFoods`. The group labels are not rendered in the add-food modal.

Does local/custom run before USDA?

- Inside `searchFoodsGrouped()`, custom foods, recipes, recent foods, and local foods are computed before USDA results are assembled.
- However, USDA is still called every time `searchFoodsGrouped()` receives a non-empty query, regardless of whether custom, recent, recipe, or local matches exist.

Under what conditions does USDA search still happen after a local match?

- In general add-food search, always. `searchFoodsGrouped()` has no early return for local matches.
- The local results are used to dedupe USDA rows by ID/name, but they do not prevent the USDA call.

### Recipe ingredient search

User action:

- Open recipe builder.
- Type an ingredient query.
- Trigger recipe ingredient search.

Code path:

- `App.searchRecipeIngredientFoods()` calls:

```ts
searchUsdaFoodsWithSynonyms(recipeIngredientQuery)
```

Does local/custom run before USDA?

- `searchUsdaFoodsWithSynonyms()` first calls `searchLocalFoods(query)`.
- It does not include custom foods or recipes. Despite its name, this helper combines local `foods.json` and USDA, not user custom foods.

Under what conditions does USDA search still happen after a local match?

- It does not if `localResults.length >= 1`.
- If at least one local database food is found, it returns only ranked local results.
- If local results are empty, it calls USDA for `[query, ...getSearchSynonyms(query)]`.

### Import matching

User action:

- Import JSON food logs.
- Confirm import preview, or review imported foods.
- Use manual search from the import review modal.

Code path:

- `buildImportFoodBatchResolver()` builds local/custom/recipe candidates first.
- If the best base candidate exists and is not generic, USDA is not searched.
- Otherwise `getUsdaImportCandidates(group.item.name)` is called.
- `getUsdaImportCandidates()` calls:

```ts
searchFoodsGrouped(query, [], [], [])
```

Then it keeps only groups where `group.label === "Packaged"`.

Manual import search:

- `openImportReviewManualSearch(item)` initializes the manual query to `item.name`.
- `searchImportReviewManualFoods()` calls `searchFoodsGrouped(query, customFoods, getRecentFoods(selectedDate), recipes)`.

## 2. USDA API / Query Construction

### Frontend wrapper

`appSupport.fetchUsdaFoods(query)` calls:

```text
GET https://jessica-worker.snack-bunker.workers.dev/?query={encodeURIComponent(query)}
```

`appSupport.fetchUsdaFoodDetail(foodId)` calls:

```text
GET https://jessica-worker.snack-bunker.workers.dev/detail?id={foodId}
```

The frontend does not send `dataType`, `brandOwner`, `pageSize`, or `sortBy` directly. It sends only `query` or `id`.

### Worker search endpoint

`jessica-worker/src/index.ts` handles `GET /?query=...`.

If query is missing, the worker defaults to:

```ts
const query = url.searchParams.get("query") || "egg";
```

The worker expands a single frontend query through `expandSearchRequests(query)`.

Base requests:

```ts
[
  { query },
  { query, brandedOnly: true }
]
```

FoodData Central endpoint:

```text
GET https://api.nal.usda.gov/fdc/v1/foods/search
```

Parameters always set:

- `query`
- `pageSize=50`
- `api_key`

Parameters conditionally set:

- `dataType=Branded` when `request.brandedOnly` is true.
- `brandOwner={brandOwner}` when `request.brandOwner` exists.

No explicit `sortBy`, `sortOrder`, or non-branded data type filter is sent.

### Branded and generic search behavior

The worker searches both generic/all data and branded data for every query:

- `{ query }`: no `dataType`, so FoodData Central can return multiple data types.
- `{ query, brandedOnly: true }`: `dataType=Branded`.

Additional branded-only requests are added for some known brands.

Known brand examples in `getKnownBrandMatch()`:

- `quest`
- `kellogg`
- `great value`
- `good and gather`
- `chobani`
- `fairlife`
- `coffee mate`

For a query like:

```text
quest protein bar peanut butter chocolate
```

`expandSearchRequests()` can produce:

```ts
[
  { query: "quest protein bar peanut butter chocolate" },
  { query: "quest protein bar peanut butter chocolate", brandedOnly: true },
  { query: "protein bar peanut butter chocolate", brandOwner: "Quest", brandedOnly: true },
  { query: "protein bar peanut butter chocolate", brandOwner: "Quest", brandedOnly: true }
]
```

The last two may dedupe if identical. Only coffee-creamer-like queries currently get category expansion via `addLikelyProductCategory()`.

## 3. Result Processing

### Worker search result mapping

Raw FoodData Central search field usage in `WorkerFood`:

| Raw USDA field | Worker field | Used? |
|---|---|---|
| `fdcId` | `id` | yes |
| `description` | `name` | yes |
| `brandOwner` | `brand` | yes |
| `foodCategory` | `category` | yes |
| `ingredients` | `ingredients` | yes in shape, not heavily displayed |
| `dataType` | `dataType` | yes |
| `foodNutrients` | not mapped for preview nutrients | mostly no |

Preview rows deliberately set:

```ts
servingSize: "Details required",
calories: 0,
protein: 0,
carbs: 0,
fat: 0,
isSearchPreview: true
```

That means search cards cannot show calories or household servings until detail is loaded.

### Worker detail result mapping

Raw FoodData Central detail field usage in `handleDetail()`:

| Raw USDA field | Worker detail field | Used by frontend? |
|---|---|---|
| `fdcId` | `id` | yes |
| `description` | `name` | mostly indirectly |
| `brandOwner` | `brand` | yes |
| `foodCategory` | `category` | yes |
| `dataType` | `dataType` | yes |
| `publicationDate` | `publicationDate` | available, not prominently displayed |
| `ingredients` | `ingredients` | available |
| `gtinUpc` | `gtinUpc` | available |
| `servingSize` | `servingSizeValue` and maybe `servingSize` | yes |
| `servingSizeUnit` | normalized `servingSizeUnit` | yes |
| `householdServingFullText` | `householdServingFullText` | yes, now used by preferred portion helper |
| `foodPortions` | normalized `foodPortions` | yes |
| `labelNutrients` | `labelNutrients` | yes |
| `foodNutrients` | `foodNutrients` | yes |

The worker also computes a normalized `nutrients` object:

```ts
nutrients: {
  calories,
  protein,
  carbs,
  fat,
  fiber,
  sugars,
  sodium
}
```

For branded foods, `getCaloriesValue()` and `getPreferredNutrientValue()` prefer `labelNutrients` before full nutrient entries.

### Serving processing

Worker:

- `getServingSizeText(food)` returns `${servingSize} ${unit}` only if `servingSizeUnit` is not `RACC` or `PORTION`.
- `getHouseholdServingText(food)` returns raw `householdServingFullText`.
- Detail response chooses:

```ts
const servingSize = getServingSizeText(food) ?? getHouseholdServingText(food) ?? "100 g";
```

Frontend:

- `parseServingSize()` extracts numeric gram/ml/oz values from strings such as `32 g` or embedded parentheticals.
- `getServingSizeBasis()` checks detail serving first, then current food serving.
- `getPreferredHouseholdPortion()` derives a single preferred household option from:
  - `householdServingFullText` plus reliable gram value from `servingSize` / `servingSizeUnit`.
  - Or matching `foodPortions`.
  - Or the first non-raw-gram `foodPortions` option.
- `getPortionOptions()` returns preferred portion first, then other portion options.

### Filtering and deduplication

Worker filters:

- `isExperimentalFood()` excludes rows whose `dataType`, `foodCategory`, or `category` contains `experimental` or `survey`.

Worker dedupe:

- Dedupes by `food.id` or fallback composite key:

```ts
food.id || `${food.name}-${food.brand}-${food.calories}-${food.servingSize}`
```

Frontend dedupe:

- `searchFoodsGrouped()` dedupes USDA by `id`.
- It also removes USDA rows whose normalized compact name exactly matches a local database food name.
- It checks `localIds`, but USDA IDs and local IDs are in different namespaces, so name dedupe is more meaningful than ID dedupe.

## 4. Ranking and Sorting

### Worker USDA preview ranking

`jessica-worker/src/index.ts` uses `rankSearchResult(food, query)`.

Positive signals:

- Foundation/SR Legacy boost if all query words appear in the name: `+30`.
- `searchableText.includes(queryText)`: `+120`.
- All query words match name/brand/category: `+90`.
- Name includes full query: `+80`.
- Query includes brand: `+55`.
- All brand words are in query: `+35`.
- Each matched word: `+16`.
- Each name-matched word: `+12`.
- Basic query plus `raw`, `cooked`, or `plain` in name: `+15`.

Negative signals:

- Name contains `juice`, `candied`, `drink`, `sauce`, `pie`, `snack`, `candy`, or `mix` but query does not: `-25` each.
- Multi-word query with only one matched word: `-45`.

This worker layer does not explicitly penalize branded foods for generic queries. It can boost Foundation/SR Legacy generic foods when all words match, but branded results can still rank well if text matches strongly.

### Frontend ranking

`appSupport.getFoodSearchScore(food, query)` ranks local, USDA, recent, custom, and recipe foods.

Positive signals:

- Foundation/SR Legacy boost if all query words appear in name: `+30`.
- Full query in `name + brand + serving`: `+130`.
- All query words matched in searchable text: `+95`.
- Name includes full query or compact name includes compact query: `+100`.
- Synonym match: `+95 + 8 per synonym`.
- All query words in name: `+70`.
- Name starts with query: `+50`.
- Brand contains full query: `+45`.
- All brand tokens are in query: `+40`.
- Per matched search word: `+16`.
- Per matched name word: `+12`.

Negative signals:

- Multi-word query with only one matched search word: `-45`.
- No matched search words and brand does not include query: `-60`.

Notably missing:

- No explicit penalty for branded foods on generic whole-food queries.
- No explicit boost for common generic foods outside Foundation/SR Legacy.
- No ingredient/UPC/package-quality scoring.
- No serving quality scoring.
- No query intent classification beyond synonyms and local `measurementType`.

### Group ordering

`searchFoodsGrouped()` returns groups in this order:

1. `My Foods`: custom foods + recipes + recent matches.
2. `Whole Foods`: local `foods.json`.
3. `Packaged`: USDA.

But `App.searchModalFood()` flattens those groups into one `modalFoods` array. The resulting order still follows group order, but the user does not see group headers in the add-food search modal.

### Are local/custom foods boosted?

For grouped add-food search:

- Yes by group order. `My Foods` appear before `Whole Foods`, which appear before `Packaged`.
- Within each group, `rankSearchResults()` sorts by `getFoodSearchScore()`.

For recipe ingredient search:

- Custom foods and recipes are not included.
- Local `foods.json` results completely suppress USDA if any local result exists.

For import matching:

- Source bonus in `getImportCandidateRankScore()`:
  - local: `+30`
  - custom: `+24`
  - recipe: `+18`
  - USDA: `+0`

### Are branded foods penalized unless brand matches?

Only indirectly.

Worker:

- Branded foods can be boosted if brand is included in query.
- There is no broad branded penalty.

Frontend:

- Brand only boosts when brand contains full query or all brand tokens are in the query.
- There is no broad branded penalty.

Import:

- USDA has no source bonus, so local/custom/recipe candidates beat USDA all else equal.
- But there is no branded penalty inside USDA candidates.

### Are common generic foods prioritized over weird branded results?

Partially.

- Foundation and SR Legacy results get modest boosts when query words match the name.
- Local `foods.json` whole foods are grouped before USDA in add-food search.
- Recipe ingredient search returns local matches without calling USDA.

But:

- Generic vs branded is not explicitly modeled in frontend search.
- Weird branded results can still appear high in `Packaged`.
- Add-food search always includes USDA packaged results even when a strong whole-food local match exists.

## 5. Display Logic

### Search result rendering

`LogView.tsx`, add-food search tab:

- Iterates over `modalFoods`.
- Card title:

```tsx
<strong>{getFoodDisplayName(food)}</strong>
```

- Brand/source:

```tsx
food.brand ? getBrandDisplayName(food.brand) : (food.dataType ?? "USDA")
```

- Calories/serving:

```tsx
getModalResultCalories(...)
getFoodSearchCalorieDisplay(...)
```

For unselected USDA previews:

- `food.isSearchPreview && selectedFood?.id !== food.id` displays `select to load nutrition`.

For selected/loaded detail:

- Displays e.g. `80 cal per slice (32 g)` when the selected portion has that display label.

### Raw USDA descriptions vs cleaned labels

The raw USDA `description` is stored as `food.name`.

Display cleanup is done by:

- `formatDisplayName(name)`
  - If all caps, title-cases the string.
  - Preserves `USDA`.
  - Removes duplicate comma suffix fragments via `removeDuplicateDisplayNameSuffix()`.
- `getFoodDisplayName(food)`
  - Applies special milk simplification for Foundation/SR Legacy milk.
  - Otherwise calls `formatDisplayName(food.name)`.

The app does not preserve raw USDA description separately. After selection, `addSelectedFood()` saves:

```ts
name: getFoodDisplayName(selectedFoodServing)
brand: getBrandDisplayName(...)
```

So the saved log item may contain the display-cleaned name, not the original raw USDA description.

### Serving label sources

Search/display helpers:

- `getFoodServingDisplay(food)` prefers:
  1. `servingLabel`
  2. explicit `amount + amountUnit`
  3. `portionLabel`
  4. `amount` with `serving`
  5. `servingSize`
  6. `"100g"`

- `getFoodSearchServingDisplay(food, servingSize)` wraps `getFoodServingDisplay()` and maps local `100g` liquids/spoonables to `cup`/`tbsp`.

- `getFoodSearchCalorieDisplay(food, calories, servingSize)` adjusts calories if `portionScale` or convertible `amountUnit` exists.

Detail serving helpers:

- `getPreferredHouseholdPortion(detail, foodName)` derives the preferred USDA portion.
- `getPortionOptions(detail, foodName)` places that preferred portion first.
- `getFoodForSelectedPortion()` uses `portion.displayLabel` when a portion is selected.

Log display:

- Daily log rows use `getFoodServingDisplay(item)`.
- Food library recent tab uses `getFoodServingDisplay(food)`.

## 6. Import Matching Logic

### Input parsing

`parseFoodLogImportJson()` accepts a JSON day object or array of day objects.

`buildImportDraft()` maps imported fields:

| Input field aliases | Draft field |
|---|---|
| `name`, `food`, `foodName` | `name` |
| `brand`, `brandName` | `brand` |
| `serving`, `servingSize`, `portion` | `serving` |
| `servings`, `quantity`, `servingCount` | `quantity` |
| `calories`, `kcal` | `calories` |
| `macros.protein` or `protein` | `protein` |
| `macros.carbs`, `carbs`, `carbohydrates` | `carbs` |
| `macros.fat` or `fat` | `fat` |

### Imported food construction

`buildImportFoodFromDraft()`:

- Parses serving with `parseImportServingBasis()`.
- Multiplies imported `quantity` by serving amount.
- Builds a temporary `Food` with a negative ID.
- Converts total calories/macros into per-serving values.

Example:

```json
{
  "name": "protein bar peanut butter chocolate",
  "serving": "1 bar",
  "quantity": "1",
  "calories": "200",
  "protein": "20",
  "carbs": "22",
  "fat": "7"
}
```

Becomes approximately:

```ts
{
  food: {
    id: -...,
    name: "protein bar peanut butter chocolate",
    servingSize: "1 bar",
    calories: 200,
    protein: 20,
    carbs: 22,
    fat: 7
  },
  quantity: 1
}
```

### Candidate generation

`buildImportFoodBatchResolver()`:

1. Builds a base candidate index from:
   - all local `foods.json` foods
   - existing custom foods
   - existing recipes
2. Groups duplicate imported rows by `areDuplicateImportedFoods()`.
3. Ranks base candidates.
4. If the best base candidate exists and is not generic, uses base candidates only.
5. Otherwise searches USDA by imported item name only:

```ts
getUsdaImportCandidates(group.item.name)
```

`getUsdaImportCandidates()`:

- Calls `searchFoodsGrouped(query, [], [], [])`.
- Keeps only the `Packaged` group.
- Caches by normalized import name.

### Candidate filtering

`getImportFoodCandidate()` rejects candidates when:

- `nameSimilarity < 65`.
- `hasIngredientOnlyCandidateMismatch(...)` is true.
- `hasCompatibleCoreFood(...)` is false.
- `hasUnsupportedPreparedSpecificity(...)` is true.

Similarity is token-sort-like:

- `normalizeImportMatchName()` lowercases, removes punctuation, singularizes, canonicalizes special token sequences, sorts tokens, and joins them.
- This means word order usually does not matter.

Flavor/modifier tokens include:

```text
strawberry, honey, peanut, chocolate, vanilla, maple, barbecue, bbq,
garlic, butter, cheese, cheddar, sweet, sour, spicy, hot, mild, plain,
flavor, flavored
```

Prepared/core tokens include:

```text
yogurt, protein, powder, bar, sauce, dressing, twist, chip, cracker,
cereal, pasta, noodle, tuna, salad, sandwich, soup, meal, bowl, wrap
```

For `protein bar peanut butter chocolate`:

- The matcher does not literally stop at `peanut` or `strawberry`.
- It keeps the full name as a USDA query.
- But `peanut`, `butter`, and `chocolate` are treated as modifier/specificity tokens, while `protein` and `bar` are prepared/core tokens.
- A candidate missing `protein` or `bar` can be rejected as ingredient-only or prepared-core mismatch.
- A candidate matching only flavor words can be rejected.

### Candidate ranking

`getImportCandidateRankScore(candidate)`:

```ts
nameSimilarity
+ specificityCoverage * 35
+ sourceBonus
- genericPenalty
```

Source bonus:

- local: `30`
- custom: `24`
- recipe: `18`
- USDA: `0`

Generic penalty:

- `+35` if generic match.
- `+20` if candidate specificity coverage is below `0.35`.

### Why "Create as new custom food" can be selected over valid matches

The review dropdown includes `"Create as new custom food"` as an option after candidates. The default selection is:

```ts
review.candidates[0]?.key ?? "new"
```

So "new" becomes default only when no candidates survive.

Valid-looking matches may be absent because:

- USDA search was skipped when a non-generic local/custom/recipe candidate existed.
- USDA import search only keeps the `Packaged` group, excluding `Whole Foods`.
- Candidate `nameSimilarity` is below `65`.
- Candidate fails core-food compatibility.
- Candidate fails prepared-specificity checks.
- Candidate is filtered by `hasIngredientOnlyCandidateMismatch()`.
- Imported serving cannot be compared and calories/macros are not used as a positive candidate discovery signal.
- The imported item has brand text, but automatic USDA import search only uses `item.name`, not `item.brand`.

## 7. Storage

### Logs

`App` stores current day logs through:

```ts
useEffect(() => {
  setStorageJson(`log-${selectedDate}`, log);
}, [log, selectedDate]);
```

When a USDA food is selected and added, `addSelectedFood()` saves a `LogItem`:

```ts
{
  ...displayFoodServing,
  category: pendingCategory,
  quantity: selectedServings,
  amount,
  amountUnit,
  portionLabel,
  portionScale,
  servingLabel,
  logId
}
```

`displayFoodServing` has:

- `name` replaced with `getFoodDisplayName(selectedFoodServing)`.
- `brand` replaced with `getBrandDisplayName(...)` when brand exists.

Therefore:

- The raw USDA description is not preserved separately in logs.
- The FDC ID is preserved as `id`.
- The data type and category are preserved if present in `displayFoodServing`.
- The selected serving display information is preserved through `servingSize`, `amount`, `amountUnit`, `portionLabel`, `portionScale`, and `servingLabel`.

### Recent foods

`getRecentFoods(selectedDate)` reads the last seven days of logs and builds recent foods from saved log items.

Fields copied include:

- `id`
- `name`
- `brand`
- `servingSize`
- `amount`
- `amountUnit`
- `portionLabel`
- `portionScale`
- `servingLabel`
- nutrients
- `loggedCount`
- `lastLoggedDate`

Recent foods are not a separate persistent food database. They are derived from log storage.

### Custom foods

Custom foods are stored in:

```text
localStorage["customFoods"]
```

via `saveCustomFoods(customFoods)`.

Imported unmatched foods are added to custom foods if they have negative IDs and are not deduped against existing custom foods.

### Top foods

`topFoods` is stored in:

```text
localStorage["topFoods"]
```

It stores only:

```ts
type TopFoodEntry = { name: string; count: number };
```

It does not store USDA IDs or preferred matches.

### Remembered import matches

Import review remembered matches are component state only:

```ts
rememberedImportMatches
```

They are applied within the current import review session by normalized item name. They are cleared when review state is reset and are not persisted across future imports.

## 8. Example USDA Search Lifecycle

Example query:

```text
quest protein bar peanut butter chocolate
```

### Step 1: User search

`LogView` calls `searchModalFood()`.

### Step 2: Frontend grouped search

`searchFoodsGrouped()`:

- Builds `My Foods` from custom foods and recipes matching the query.
- Adds matching recent foods.
- Calls `searchLocalFoods(query)`.
- Builds search queries from:

```ts
[query, ...getSearchSynonyms(query)]
```

For this specific example, `getSearchSynonyms()` only helps if the query matches a configured key in `brandSynonyms`; `quest` is not in frontend `brandSynonyms`.

### Step 3: Worker search

`fetchUsdaFoods(query)` calls:

```text
GET /?query=quest%20protein%20bar%20peanut%20butter%20chocolate
```

Worker `expandSearchRequests()` recognizes `quest` and calls FoodData Central with:

- all-data query
- branded-only query
- brandOwner `Quest` branded-only product query

Each call uses:

```text
/v1/foods/search?query=...&pageSize=50&api_key=...
```

plus optional:

```text
dataType=Branded
brandOwner=Quest
```

### Step 4: Worker processing

The worker:

- Drops experimental/survey rows.
- Maps fields to preview `WorkerFood`.
- Sorts by `rankSearchResult()`.
- Dedupes by FDC ID.
- Returns up to 15 preview rows.

### Step 5: Frontend result display

The frontend:

- Dedupes against local foods by compact normalized name.
- Ranks USDA rows with `rankSearchResults()`.
- Adds them to the `Packaged` group.
- Flattens groups into `modalFoods`.
- Displays `getFoodDisplayName(food)`.
- Shows `select to load nutrition` for unselected USDA previews.

### Step 6: Detail load

When the user clicks a USDA preview:

- `selectFood(food)` calls `fetchUsdaFoodDetail(food.id)`.
- Worker calls `/v1/food/{fdcId}`.
- Worker returns normalized detail with nutrients, label nutrients, `householdServingFullText`, `servingSize`, `servingSizeUnit`, and `foodPortions`.

### Step 7: Serving/nutrition selection

Frontend:

- Converts detail into a loaded food with `getFoodForSelectedPortion()`.
- Derives preferred household serving with `getPreferredHouseholdPortion()`.
- Defaults amount to `1`, unit display to the household label when reliable, and keeps gram weight for scaling.

### Step 8: Save

When added:

- Log item is saved into `log-YYYY-MM-DD`.
- FDC ID remains as `id`.
- Cleaned display name is saved as `name`.
- Raw USDA name is not separately saved.

## Current Ranking Rules

### Add-food modal

Effective order:

1. Custom foods and recipes, ranked by frontend score.
2. Recent matches, ranked by frontend score and appended after custom/recipe in `My Foods`.
3. Local `foods.json` foods, ranked by frontend score.
4. USDA packaged foods, ranked by worker score then frontend score.

Because `App.searchModalFood()` flattens groups, users see a single list without headings.

### Recipe ingredient modal

Effective order:

1. If local `foods.json` returns any result, use those only.
2. Otherwise use USDA plus frontend synonyms, ranked by frontend score.

### Import review

Effective order:

1. Local/custom/recipe base candidates.
2. USDA packaged candidates only if no good non-generic base candidate exists.
3. Sort by import rank score:
   - name similarity
   - specificity coverage
   - source bonus
   - generic penalty

## Current Display Rules

### Food names

- Stored raw names are formatted at render time using `getFoodDisplayName()`.
- All-caps USDA names are title-cased.
- Duplicate comma suffixes can be removed.
- Milk has special simplification for Foundation/SR Legacy records.

### Brands

- `getBrandDisplayName()` title-cases all-caps brands.
- Missing brand displays as `Generic` in some contexts.

### Search card serving/calories

- USDA preview not selected: `select to load nutrition`.
- USDA selected/loading: `Loading...`.
- USDA selected/loaded: calories and serving from `getModalResultCalories()` and `getFoodSearchCalorieDisplay()`.
- Local/custom/recent/recipe foods: use stored calories and serving labels.

### Serving modal

- The modal uses `portionOptions` and `selectedPortion`.
- Preferred household portions are first when reliable.
- Helper text comes from `servingBasisText`.
- The amount/unit controls still use internal `AmountUnit` values, but the displayed serving unit can show the household label.

## Problems Found

### 1. Raw USDA wording still leaks into identity

`food.name` is raw USDA `description`. Display formatting helps, but it is not a semantic cleanup layer. Examples of messiness that can leak:

- Long comma-delimited database descriptions.
- Product descriptors in odd order.
- All-caps branded descriptions that become title-cased but not rewritten.
- Duplicate or near-duplicate wording not caught by `removeDuplicateDisplayNameSuffix()`.

Intervention point:

- Add a display-name polish layer after USDA search/detail mapping but before UI display and storage.
- Preserve `rawName` separately if adding this layer.

### 2. Search grouping is computed but not shown

`searchFoodsGrouped()` returns `My Foods`, `Whole Foods`, and `Packaged`, but `App.searchModalFood()` flattens groups into `modalFoods`. The user cannot tell which results are local vs USDA except by brand/source text.

Intervention point:

- Preserve `SearchResultGroup[]` in component state and render group headings in `LogView`.

### 3. USDA is always called in general add-food search

Even when a good custom/local match exists, `searchFoodsGrouped()` still calls USDA. This can add noise and latency.

Intervention point:

- Add query intent / confidence gating in `searchFoodsGrouped()`.
- For strong local whole-food matches, optionally suppress or demote `Packaged`.

### 4. Generic vs branded intent is weak

Worker and frontend ranking boost matching text, but neither has a robust classifier for:

- User wants generic whole food.
- User wants packaged/branded food.
- User typed a known brand.
- User typed a UPC-like or product-like query.

Intervention point:

- Add an intent layer before merging results:
  - Whole-food queries: boost local/Foundation/SR Legacy and demote branded.
  - Brand/product queries: boost branded, brandOwner matches, exact product phrases.

### 5. Worker previews intentionally omit nutrients

USDA preview rows show no calories/servings until detail lookup. This avoids expensive detail calls but makes initial cards less useful.

Intervention point:

- Consider using search-result nutrient snippets when reliable, or lazy-prefetch detail for top few visible USDA results.

### 6. Import matching only searches USDA packaged results

`getUsdaImportCandidates()` keeps only `Packaged`. Imported rows that should match local/Foundation/SR Legacy whole foods will not get USDA whole-food candidates through this path.

Intervention point:

- Let import matching consume `Whole Foods` and `Packaged`, or call a specialized search that returns both with source/type metadata.

### 7. Import USDA query ignores brand and serving

Automatic USDA import candidate search uses only:

```ts
group.item.name
```

It does not include:

- `item.brand`
- serving text
- calories/macros
- source notes

Intervention point:

- Build richer import search queries:
  - `{brand} {name}`
  - `{name} {serving unit}`
  - known product category expansions
  - brand-specific worker requests when brand is present

### 8. Import matching can over-filter before ranking

Valid matches can be rejected before ranking by:

- `nameSimilarity < 65`.
- ingredient-only mismatch.
- core-food mismatch.
- unsupported prepared specificity.

The token sets improve precision, but flavor tokens like `peanut`, `strawberry`, and `chocolate` are treated as modifiers. This prevents single-flavor ingredient matches, but it can also make flavor-rich product names fragile if the candidate name words are sparse.

Intervention point:

- Log rejection reasons during import candidate generation.
- Show candidate debug data in review mode.
- Make filters softer by assigning penalties instead of hard rejection for some cases.

### 9. "Create as new custom food" is default when no candidates survive

The UI does not recommend "new" over real candidates when candidates exist. However, if all candidates are filtered out, `getDefaultImportReviewSelection()` returns `"new"`.

Intervention point:

- Surface "No confident matches found" separately from "Create custom food".
- Show low-confidence candidates under a warning rather than dropping them completely.

### 10. Raw USDA source is not preserved separately on save

`addSelectedFood()` stores display-cleaned `name` and `brand`, not separate raw USDA name/brand fields. That is user-friendly for logs but loses traceability.

Intervention point:

- Add optional fields such as `rawName`, `rawBrand`, `fdcId`, `fdcDataType`, and `displayName`.
- Migrate carefully because logs are localStorage-first.

### 11. Remembered import matches are not persistent

`rememberedImportMatches` helps only inside the current import review session. Future imports do not reuse those choices.

Intervention point:

- Add persisted import match memory keyed by normalized imported name and maybe brand/serving.
- Store selected target food ID/source and validate existence before reuse.

## Recommended Intervention Points

### Highest value, lowest risk

1. Preserve grouped search state.
   - File: `App.tsx`
   - Functions: `searchModalFood()`, `LogView` rendering
   - Benefit: users can distinguish `My Foods`, `Whole Foods`, and `Packaged`.

2. Add a USDA display polish object.
   - File: `appSupport.ts`
   - Functions: `formatDisplayName()`, `getFoodDisplayName()`, worker mapping or frontend mapping
   - Suggested shape:

```ts
type Food = {
  name: string;       // current display or canonical name
  rawName?: string;   // raw USDA description
  brand: string | null;
  rawBrand?: string | null;
  ...
};
```

3. Add import candidate rejection logging.
   - File: `App.tsx`
   - Function: `getImportFoodCandidate()`
   - Benefit: explains why valid-looking USDA matches vanish.

### Medium risk, high value

4. Add query intent classification.
   - File: `appSupport.ts` and possibly `jessica-worker/src/index.ts`
   - Use it in `searchFoodsGrouped()`, `getFoodSearchScore()`, and worker `rankSearchResult()`.
   - Demote branded foods for whole-food queries and boost brandOwner/product matches for branded queries.

5. Improve import USDA query generation.
   - File: `App.tsx`
   - Functions: `getUsdaImportCandidates()`, `buildImportFoodBatchResolver()`
   - Include brand, product category, and serving signals.

6. Keep low-confidence import candidates.
   - File: `App.tsx`
   - Function: `getImportFoodCandidate()`
   - Convert some hard rejections into penalties and mark confidence as low.

### Higher risk

7. Persist preferred import matches.
   - File: `App.tsx`, `appSupport.ts`
   - Requires localStorage schema and careful stale-reference handling.

8. Prefetch USDA detail for top search results.
   - File: `App.tsx`, `appSupport.ts`
   - Improves initial serving/calorie display but increases network usage and latency.

9. Worker-side richer USDA scoring.
   - File: `jessica-worker/src/index.ts`
   - Add data-type intent scoring, brand-owner quality scoring, and product/category-specific logic.
   - Requires deployment coordination because the frontend uses the production worker URL.

