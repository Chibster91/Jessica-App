/**
 * TypeScript types for the USDA FoodData Central API.
 * Based on the OpenAPI 3.0 spec at https://api.nal.usda.gov/fdc/v1/json-spec
 *
 * Note: the real API search endpoint returns nutrients with different field names
 * than the spec (nutrientName/value instead of name/amount). Both are modeled below.
 */

/** Nutrient entry in /v1/foods/search results.
 * The spec defines AbridgedFoodNutrient with `name` and `amount`,
 * but the real API uses `nutrientName`, `nutrientNumber`, and `value`. */
export interface FdcSearchNutrient {
  nutrientId?: number;
  nutrientNumber?: string;
  nutrientName?: string;   // real API field; spec says "name"
  name?: string;           // spec field
  amount?: number;         // spec field
  value?: number;          // real API field; spec says "amount"
  unitName?: string;
  derivationCode?: string;
  derivationDescription?: string;
}

/** A food item returned by GET /v1/foods/search (SearchResultFood schema). */
export interface FdcSearchResultFood {
  fdcId: number;
  dataType?: string;
  description: string;
  brandOwner?: string;
  gtinUpc?: string;
  ingredients?: string;
  ndbNumber?: string;
  foodCode?: string;
  publicationDate?: string;
  scientificName?: string;
  additionalDescriptions?: string;
  score?: number;
  foodNutrients?: FdcSearchNutrient[];
  // Present in real API responses for Foundation/SR Legacy foods; not in spec:
  foodCategory?: string;
}

/** Response envelope from GET /v1/foods/search (SearchResult schema). */
export interface FdcSearchResponse {
  foodSearchCriteria?: unknown;
  totalHits?: number;
  currentPage?: number;
  totalPages?: number;
  foods?: FdcSearchResultFood[];
}

/** Nutrient entry in full food detail responses (FoodNutrient schema). */
export interface FdcFoodNutrient {
  id?: number;
  amount?: number;
  type?: string;
  dataPoints?: number;
  min?: number;
  max?: number;
  median?: number;
  nutrient?: {
    id?: number;
    number?: string;
    name?: string;
    rank?: number;
    unitName?: string;
  };
}

/** Food portion entry (FoodPortion schema). */
export interface FdcFoodPortion {
  id?: number;
  amount?: number;
  gramWeight?: number;
  modifier?: string;
  portionDescription?: string;
  sequenceNumber?: number;
  dataPoints?: number;
  measureUnit?: {
    id?: number;
    name?: string;
    abbreviation?: string;
  };
}

/** Label nutrients on BrandedFoodItem (spec has a typo: "postassium"). */
export interface FdcLabelNutrients {
  fat?: { value?: number };
  saturatedFat?: { value?: number };
  transFat?: { value?: number };
  cholesterol?: { value?: number };
  sodium?: { value?: number };
  carbohydrates?: { value?: number };
  fiber?: { value?: number };
  sugars?: { value?: number };
  protein?: { value?: number };
  calcium?: { value?: number };
  iron?: { value?: number };
  postassium?: { value?: number };  // sic — matches the FDC spec typo
  calories?: { value?: number };
}

/** Full food item returned by GET /v1/food/{fdcId}.
 * Covers BrandedFoodItem, FoundationFoodItem, SRLegacyFoodItem, SurveyFoodItem. */
export interface FdcFoodDetail {
  fdcId: number;
  dataType?: string;
  description: string;
  foodClass?: string;
  publicationDate?: string;
  // Branded-only fields:
  brandOwner?: string;
  gtinUpc?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  brandedFoodCategory?: string;
  labelNutrients?: FdcLabelNutrients;
  // Foundation / SR Legacy fields:
  ndbNumber?: string;
  scientificName?: string;
  isHistoricalReference?: boolean;
  // Foundation / SR Legacy / Survey:
  foodCategory?: { id?: number; code?: string; description?: string } | string;
  foodPortions?: FdcFoodPortion[];
  foodNutrients?: FdcFoodNutrient[];
}
