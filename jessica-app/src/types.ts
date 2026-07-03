export type Food = {
  id: number;
  name: string;
  brand: string | null;
  /** USDA consumer brand ("Nutella"), distinct from `brand` (brandOwner / parent company).
   * Captured for brand-intent search scoring; may be null for non-branded foods. */
  brandName?: string | null;
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
  /** Trimmed USDA detail (portions, label serving, calorie basis) kept on foods saved
   * from USDA search so portion options keep working offline without a re-fetch. */
  savedDetail?: FoodDetail;
  /** True for canonical entries served from the worker's D1 database. */
  canonical?: boolean;
  /** Worker hint: the query matched this food's brand in the D1 brands table. */
  brandMatch?: boolean;
};

export type RecipeIngredient = {
  food: Food;
  quantity: number;
};

export type Recipe = Food & {
  ingredients: RecipeIngredient[];
};

export type FoodPortion = {
  id?: number | string;
  amount?: number | null;
  modifier?: string | null;
  gramWeight?: number | null;
  measureUnit?: {
    name?: string | null;
    abbreviation?: string | null;
  } | null;
};

export type FoodNutrient = {
  amount?: number;
  value?: number;
  nutrientName?: string;
  unitName?: string;
  nutrient?: {
    name?: string;
    unitName?: string;
  };
};

export type FoodDetail = {
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
  labelNutrients?: {
    fat?: { value?: number | null } | null;
    saturatedFat?: { value?: number | null } | null;
    transFat?: { value?: number | null } | null;
    cholesterol?: { value?: number | null } | null;
    sodium?: { value?: number | null } | null;
    carbohydrates?: { value?: number | null } | null;
    fiber?: { value?: number | null } | null;
    sugars?: { value?: number | null } | null;
    protein?: { value?: number | null } | null;
    calcium?: { value?: number | null } | null;
    iron?: { value?: number | null } | null;
    calories?: { value?: number | null } | null;
  } | null;
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

export type PortionOption = {
  value: string;
  label: string;
  gramWeight: number;
  amount?: number;
  unitLabel?: string;
  displayLabel?: string;
  helperText?: string;
};

export type AddFoodTab = "search" | "recent" | "custom" | "recipes";

export type AppView = "home" | "day" | "library" | "profile" | "weight" | "egg-oracle";

export type FoodLibraryTab = "recent" | "custom" | "recipes" | "database";

export type Sex = "female" | "male";

export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "veryActive";

export type GoalType = "lose" | "maintain" | "gain";

export type GoalRate = "mild" | "moderate" | "aggressive";

export type ProfileActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";

export type ProfileUnits = "imperial" | "metric";

export type MacroMode = "percentages" | "grams" | "none";

export type MacroPreset = "balanced" | "high_protein" | "custom";

export type HeightUnit = "ftIn" | "cm" | "in";

export type WeightUnit = "kg" | "lb";

export type EnergyUnit = "cal" | "kj";

export type LibrarySelection =
  | { type: "recent"; food: Food & { loggedCount?: number; lastLoggedDate?: string } }
  | { type: "custom"; food: Food }
  | { type: "recipe"; food: Recipe };

export type CalculatorInputs = {
  age: string;
  sex: Sex;
  height: string;
  heightFeet?: string;
  heightInches?: string;
  heightUnit: HeightUnit;
  weight: string;
  weightUnit: WeightUnit;
  activityLevel: ActivityLevel;
  goal: GoalType;
  rate: GoalRate;
};

export type TopFoodEntry = { name: string; count: number };

export type Goals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goalWeight?: number;
  goalWeightUnit?: WeightUnit;
  calculatorInputs?: CalculatorInputs;
};

export type Profile = {
  name: string;
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  goalWeightKg?: number;
  activityLevel: ProfileActivityLevel;
  goal: GoalType;
  weeklyRateKg: number;
  calculatedCalories: number;
  manualCalorieOverride: number | null;
  useManualCalories: boolean;
  macroMode: MacroMode;
  macros: {
    proteinPct: number;
    carbPct: number;
    fatPct: number;
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
  };
  units: ProfileUnits;
  trackCycle: boolean;
  startingWeightKg: number;
  profileCreatedAt: string;
  profileUpdatedAt: string;
  // Display & settings preferences — optional so profiles saved before these
  // existed still load; always read with a `?? default` fallback.
  weightUnit?: WeightUnit;
  energyUnit?: EnergyUnit;
  showStreak?: boolean;
  showMacros?: boolean;
  quickAdd?: boolean;
  barcodeScanner?: boolean;
  notifications?: boolean;
  logReminder?: boolean;
  weightReminder?: boolean;
};

export type ProfileForm = {
  name: string;
  units: ProfileUnits;
  age: string;
  sex: Sex;
  heightCm: string;
  heightFeet: string;
  heightInches: string;
  weight: string;
  goalWeight: string;
  activityLevel: ProfileActivityLevel;
  goal: GoalType;
  weeklyRateKg: string;
  useManualCalories: boolean;
  manualCalorieOverride: string;
  macroMode: MacroMode;
  macroPreset: MacroPreset;
  proteinPct: string;
  carbPct: string;
  fatPct: string;
  proteinGrams: string;
  carbGrams: string;
  fatGrams: string;
  trackCycle: boolean;
};

export type ProfileCalculation = {
  bmr: number;
  tdee: number;
  goalAdjustment: number;
  calculatedCalories: number;
  activeCalories: number;
};

export type WeightRange = "1M" | "3M" | "6M" | "1Y" | "All";

export type WeightEntry = {
  id: string;
  date: string;
  weight: number;
  unit: WeightUnit;
  note?: string;
};

export type WeightForm = {
  date: string;
  weight: string;
  note: string;
};

export type CustomFoodForm = {
  name: string;
  brand: string;
  servingSize: string;
  servingUnit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  sugar: string;
  sodium: string;
  notes: string;
};

export type FoodLogImportDraft = {
  id: string;
  date: string;
  meal: string;
  name: string;
  brand: string;
  serving: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  notes: string;
  source: string;
};

export type WeightImportEntry = {
  id: string;
  date: string;
  weightLb: number;
};

export type FoodLogImportResult =
  | { ok: true; items: FoodLogImportDraft[]; weightEntries: WeightImportEntry[]; isMultiDay: boolean }
  | { ok: false; errors: string[] };

export type ScannedNutritionFields = Partial<
  Pick<
    CustomFoodForm,
    "servingSize" | "servingUnit" | "calories" | "fat" | "carbs" | "protein" | "sugar" | "fiber" | "sodium"
  >
>;

/** Prefilled fields used to seed the manual-entry form (from barcode/scan lookups). */
export type PrefillData = {
  name?: string;
  serving?: string;
  calories?: number;
  protein?: string;
  carbs?: string;
  fat?: string;
};

/** Recipe fields parsed from a screenshot via on-device OCR. */
export type ScannedRecipeFields = {
  name: string;
  ingredients: string[];
  calories?: string;
  protein?: string;
  carbs?: string;
  fat?: string;
};

/** Recipe data scraped from a URL by the worker's /recipe endpoint. */
export type ImportedRecipe = {
  name: string;
  servings: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  ingredients: string[];
};

export type RecipeForm = {
  name: string;
  servingSize: string;
  servingUnit: string;
  notes: string;
};

export type AmountUnit =
  | "serving"
  | "g"
  | "oz"
  | "ml"
  | "cup"
  | "tbsp"
  | "tsp";

export type MeasuredAmountUnit = Exclude<AmountUnit, "serving">;

export type DebugLogEntry = {
  time: string;
  event: string;
  detail?: unknown;
};

export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type GoogleTokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
};

export type GoogleAccounts = {
  accounts?: {
    oauth2?: {
      initTokenClient: (config: {
        client_id: string;
        scope: string;
        callback: (response: GoogleTokenResponse) => void;
      }) => GoogleTokenClient;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleAccounts;
  }
}

export type GoogleDriveUploadResponse = {
  id?: string;
  name?: string;
  webViewLink?: string;
};

export type GoogleDriveFile = {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
};

export type GoogleDriveFileListResponse = {
  files?: GoogleDriveFile[];
};

export type OAuthPendingAction = {
  action: "export" | "import-list" | "import-file";
  clientId: string;
  fileId?: string;
  fileName?: string;
  returnView?: AppView;
  returnDate?: string;
  timestamp: number;
};

export type MealCategory = string;

export type ImportedFoodAudit = {
  name: string;
  brand?: string;
  serving: string;
  quantity: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  source?: string;
  notes?: string;
  resolvedSource?: string;
  resolvedFoodId?: number;
  confidence?: string;
};

export type LogItem = Food & { logId: string; category: MealCategory; quantity: number; importAudit?: ImportedFoodAudit };

export type SavedLogItem = Food & { logId: string; category?: MealCategory; quantity?: number };
