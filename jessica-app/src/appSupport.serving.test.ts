import { describe, expect, it } from "vitest";
import {
  parseServingSize,
  getMeasuredServingBasis,
  getFoodDensity,
  getTypicalServing,
  getSearchTypicalServing,
  getFoodSearchCalorieDisplay,
  formatTypicalServingDisplay,
  applyTypicalServing,
  convertAmountToBasisUnit,
  getScaleFromServingBasis,
  parseIngredientAmount,
  ingredientServingsFromAmount,
  scaleFoodNutrition,
  parseDecimalInput,
  getItemCalories,
  getLogCategoryTotals,
  toStorableFoodDetail,
  getEnergyCaloriesPer100Units,
  type Food,
  type FoodDetail,
  type LogItem,
} from "./appSupport";

describe("parseServingSize", () => {
  it("parses amount and unit from plain strings", () => {
    expect(parseServingSize("2 oz")).toEqual({ amount: 2, unit: "oz" });
    expect(parseServingSize("100g")).toEqual({ amount: 100, unit: "g" });
    expect(parseServingSize("3.5 oz")).toEqual({ amount: 3.5, unit: "oz" });
  });

  it("prefers an embedded metric measure over the leading amount", () => {
    expect(parseServingSize("1 cup (240 ml)")).toEqual({ amount: 240, unit: "ml" });
    expect(parseServingSize("1 scoop (32 grams)")).toEqual({ amount: 32, unit: "g" });
  });

  it("uses the fallback unit for numeric serving sizes", () => {
    expect(parseServingSize(28, "G")).toEqual({ amount: 28, unit: "g" });
  });

  it("keeps unrecognized units as lowercase text", () => {
    expect(parseServingSize("1 container")).toEqual({ amount: 1, unit: "container" });
  });

  it("converts fluid ounces and liters to ml", () => {
    expect(parseServingSize("12 fl oz")).toEqual({ amount: 354.9, unit: "ml" });
    expect(parseServingSize("12 FL OZ can")).toEqual({ amount: 354.9, unit: "ml" });
    expect(parseServingSize("8 fluid ounces")).toEqual({ amount: 236.6, unit: "ml" });
    expect(parseServingSize("1 liter")).toEqual({ amount: 1000, unit: "ml" });
    expect(parseServingSize("2 Liters")).toEqual({ amount: 2000, unit: "ml" });
    expect(parseServingSize("1.25 L")).toEqual({ amount: 1250, unit: "ml" });
  });

  it("keeps plain weight ounces as oz and does not misread lb/large as liters", () => {
    expect(parseServingSize("12 oz")).toEqual({ amount: 12, unit: "oz" });
    expect(parseServingSize("1 lb")).toEqual({ amount: 1, unit: "lb" });
    expect(parseServingSize("1 large")).toEqual({ amount: 1, unit: "large" });
  });

  it("returns null for unparseable or non-positive sizes", () => {
    expect(parseServingSize("Details required")).toBeNull();
    expect(parseServingSize("0 g")).toBeNull();
    expect(parseServingSize(null)).toBeNull();
    expect(parseServingSize(undefined)).toBeNull();
  });
});

describe("getMeasuredServingBasis", () => {
  it("returns a basis only for measurable units", () => {
    expect(getMeasuredServingBasis({ servingSize: "100 g" })).toEqual({ amount: 100, unit: "g" });
    expect(getMeasuredServingBasis({ servingSize: "1 scoop (32g)" })).toEqual({ amount: 32, unit: "g" });
    expect(getMeasuredServingBasis({ servingSize: "1 container" })).toBeNull();
  });
});

describe("convertAmountToBasisUnit", () => {
  it("passes serving and same-unit amounts through unchanged", () => {
    expect(convertAmountToBasisUnit(3, "serving", "g")).toBe(3);
    expect(convertAmountToBasisUnit(50, "g", "g")).toBe(50);
    expect(convertAmountToBasisUnit(10, "ml", "ml")).toBe(10);
  });

  it("converts weight units exactly", () => {
    expect(convertAmountToBasisUnit(2, "oz", "g")).toBeCloseTo(56.69904625, 8);
    expect(convertAmountToBasisUnit(100, "g", "oz")).toBeCloseTo(3.5273961949580412, 8);
  });

  it("converts volume units to grams at the water default of 1 g/ml", () => {
    expect(convertAmountToBasisUnit(100, "ml", "g")).toBeCloseTo(100, 8);
    expect(convertAmountToBasisUnit(1, "tbsp", "g")).toBeCloseTo(15, 8);
    expect(convertAmountToBasisUnit(1, "tsp", "g")).toBeCloseTo(5, 8);
    expect(convertAmountToBasisUnit(1, "cup", "g")).toBeCloseTo(240, 8);
  });

  it("applies a per-food density to volume-to-weight conversions", () => {
    expect(convertAmountToBasisUnit(100, "ml", "g", 0.92)).toBeCloseTo(92, 8);
    expect(convertAmountToBasisUnit(1, "tbsp", "g", 1.42)).toBeCloseTo(21.3, 8);
    expect(convertAmountToBasisUnit(1, "tbsp", "oz", 0.92)).toBeCloseTo(13.8 / 28.349523125, 8);
  });

  it("converts volume to an ml basis without needing density", () => {
    expect(convertAmountToBasisUnit(1, "cup", "ml")).toBe(240);
    expect(convertAmountToBasisUnit(2, "tbsp", "ml")).toBe(30);
  });

  it("converts weight to an ml basis through density", () => {
    expect(convertAmountToBasisUnit(50, "g", "ml")).toBeCloseTo(50, 8);
    expect(convertAmountToBasisUnit(71, "g", "ml", 1.42)).toBeCloseTo(50, 8);
  });
});

describe("getFoodDensity", () => {
  it("matches known foods by whole-word keyword", () => {
    expect(getFoodDensity({ name: "Whole Milk" })).toBe(1.03);
    expect(getFoodDensity({ name: "Olive Oil" })).toBe(0.92);
    expect(getFoodDensity({ name: "Honey, raw" })).toBe(1.42);
    expect(getFoodDensity({ name: "All-Purpose Flour" })).toBe(0.53);
  });

  it("prefers specific multi-word rules over general ones", () => {
    expect(getFoodDensity({ name: "Creamy Peanut Butter" })).toBe(1.09);
    expect(getFoodDensity({ name: "Vanilla Ice Cream" })).toBe(0.55);
    expect(getFoodDensity({ name: "Heavy Cream" })).toBe(1.01);
  });

  it("does not match keywords inside other words and defaults to 1", () => {
    expect(getFoodDensity({ name: "Boiled Egg" })).toBe(1);
    expect(getFoodDensity({ name: "Chicken Breast" })).toBe(1);
  });
});

describe("getScaleFromServingBasis", () => {
  it("scales relative to the parsed serving basis", () => {
    expect(getScaleFromServingBasis({ servingSize: "100 g" }, 150)).toBe(1.5);
    expect(getScaleFromServingBasis({ servingSize: "1 container" }, 150)).toBeNull();
  });
});

const yogurt: Food = {
  id: 1,
  name: "Greek Yogurt",
  brand: null,
  servingSize: "100 g",
  calories: 60,
  protein: 10,
  carbs: 4,
  fat: 0.4,
};

describe("scaleFoodNutrition", () => {
  it("rounds calories and scales macros", () => {
    const scaled = scaleFoodNutrition(yogurt, 1.5, "150 g");
    expect(scaled.servingSize).toBe("150 g");
    expect(scaled.calories).toBe(90);
    expect(scaled.protein).toBeCloseTo(15, 8);
    expect(scaled.carbs).toBeCloseTo(6, 8);
    expect(scaled.fat).toBeCloseTo(0.6, 8);
  });

  it("leaves absent optional nutrients undefined", () => {
    const scaled = scaleFoodNutrition(yogurt, 2, "200 g");
    expect(scaled.fiber).toBeUndefined();
    expect(scaled.sugar).toBeUndefined();
    expect(scaled.sodium).toBeUndefined();
  });

  it("scales optional nutrients when present", () => {
    const scaled = scaleFoodNutrition({ ...yogurt, fiber: 2, sodium: 50 }, 2, "200 g");
    expect(scaled.fiber).toBe(4);
    expect(scaled.sodium).toBe(100);
  });
});

describe("parseDecimalInput", () => {
  it("accepts comma or dot decimal separators", () => {
    expect(parseDecimalInput("1,5")).toBe(1.5);
    expect(parseDecimalInput("2.5")).toBe(2.5);
    expect(parseDecimalInput(" 3 ")).toBe(3);
  });

  it("returns 0 for empty input and NaN for text", () => {
    expect(parseDecimalInput("")).toBe(0);
    expect(parseDecimalInput("abc")).toBeNaN();
  });
});

describe("log totals", () => {
  const item = (overrides: Partial<LogItem>): LogItem => ({
    ...yogurt,
    logId: "x",
    category: "Breakfast",
    quantity: 1,
    ...overrides,
  });

  it("rounds per-item calories after applying quantity", () => {
    expect(getItemCalories({ calories: 78.4, quantity: 2 })).toBe(157);
  });

  it("sums totals for a single category", () => {
    const log = [
      item({ logId: "a", quantity: 2 }),
      item({ logId: "b", calories: 78.4, protein: 6 }),
      item({ logId: "c", category: "Lunch", calories: 500 }),
    ];
    expect(getLogCategoryTotals(log, "Breakfast")).toEqual({
      calories: 198,
      protein: 26,
      carbs: 12,
      fat: 1.2000000000000002,
    });
  });
});

describe("parseIngredientAmount", () => {
  it("parses tablespoons, teaspoons, and cups", () => {
    expect(parseIngredientAmount("8 Tbsp unsalted butter")).toEqual({ amount: 8, unit: "tbsp" });
    expect(parseIngredientAmount("1 1/2 tsp cinnamon")).toEqual({ amount: 1.5, unit: "tsp" });
    expect(parseIngredientAmount("7 cups apples")).toEqual({ amount: 7, unit: "cup" });
  });

  it("handles mixed numbers and converts lb to oz", () => {
    expect(parseIngredientAmount("2 1/4 lbs Granny Smith apples")).toEqual({ amount: 36, unit: "oz" });
  });

  it("returns null for non-measurable units or no leading amount", () => {
    expect(parseIngredientAmount("2 cloves garlic")).toBeNull();
    expect(parseIngredientAmount("salt to taste")).toBeNull();
  });
});

describe("ingredientServingsFromAmount", () => {
  const butter: Food = {
    id: -1,
    name: "Butter, unsalted",
    brand: null,
    servingSize: "100 g",
    calories: 717,
    protein: 0.9,
    carbs: 0.1,
    fat: 81,
    measurementType: "spoonable",
  };

  it("converts tbsp to a serving multiplier using density (8 tbsp butter ≈ 1.14 × 100g)", () => {
    expect(ingredientServingsFromAmount(butter, 8, "tbsp")).toBeCloseTo(1.14, 2);
  });

  it("passes serving units through unchanged", () => {
    expect(ingredientServingsFromAmount(butter, 2, "serving")).toBe(2);
  });
});

describe("getTypicalServing", () => {
  it("matches whole words including plain plurals and -ies plurals", () => {
    expect(getTypicalServing({ name: "Carrots" })).toEqual({ gramWeight: 61, label: "1 medium carrot" });
    expect(getTypicalServing({ name: "Apples, with skin" })).toEqual({ gramWeight: 182, label: "1 medium apple" });
    expect(getTypicalServing({ name: "Strawberries" })).toEqual({ gramWeight: 152, label: "1 cup" });
    expect(getTypicalServing({ name: "Cherries, sweet" })).toEqual({ gramWeight: 138, label: "1 cup" });
  });

  it("prefers specific rules over the general ones they overlap", () => {
    expect(getTypicalServing({ name: "Sweet potato, baked with skin" })).toEqual({ gramWeight: 130, label: "1 medium" });
    expect(getTypicalServing({ name: "Green beans" })).toEqual({ gramWeight: 125, label: "1 cup" });
    expect(getTypicalServing({ name: "Peanut butter, creamy" })).toEqual({ gramWeight: 32, label: "2 tbsp" });
    expect(getTypicalServing({ name: "Olive oil" })).toEqual({ gramWeight: 14, label: "1 tbsp" });
    expect(getTypicalServing({ name: "Hot dog bun" })).toEqual({ gramWeight: 46, label: "1 bun" });
    expect(getTypicalServing({ name: "Bell pepper, orange" })).toEqual({ gramWeight: 119, label: "1 medium pepper" });
    expect(getTypicalServing({ name: "Tuna, canned in oil" })).toEqual({ gramWeight: 85, label: "3 oz" });
  });

  it("does not match keywords inside other words", () => {
    expect(getTypicalServing({ name: "Pineapple" })).toEqual({ gramWeight: 165, label: "1 cup chunks" });
    expect(getTypicalServing({ name: "Grapefruit" })).toEqual({ gramWeight: 123, label: "1/2 grapefruit" });
    expect(getTypicalServing({ name: "Popcorn, air-popped" })).toEqual({ gramWeight: 24, label: "3 cups popped" });
    expect(getTypicalServing({ name: "Goat cheese" })).toEqual({ gramWeight: 28, label: "1 oz" });
  });

  it("never pins a cooked serving onto a dry or raw entry", () => {
    expect(getTypicalServing({ name: "White rice, long-grain, cooked" })).toEqual({ gramWeight: 158, label: "1 cup cooked" });
    expect(getTypicalServing({ name: "Rice, white, raw" })).toBeNull();
    expect(getTypicalServing({ name: "Pasta, dry" })).toBeNull();
  });

  it("returns null when nothing matches", () => {
    expect(getTypicalServing({ name: "Starfruit" })).toBeNull();
  });

  it("measures composite salads as a dish, not by a single ingredient", () => {
    // Regression: "potato salad with egg" was reading as "1 large egg", and
    // "potato salad" as "1 medium potato".
    expect(getTypicalServing({ name: "Potato salad with egg" })).toEqual({ gramWeight: 125, label: "1/2 cup" });
    expect(getTypicalServing({ name: "Potato salad, home-prepared" })).toEqual({ gramWeight: 125, label: "1/2 cup" });
    expect(getTypicalServing({ name: "Egg salad" })).toEqual({ gramWeight: 110, label: "1/2 cup" });
    expect(getTypicalServing({ name: "Tuna salad" })).toEqual({ gramWeight: 102, label: "1/2 cup" });
    expect(getTypicalServing({ name: "Coleslaw" })).toEqual({ gramWeight: 90, label: "1/2 cup" });
    expect(getTypicalServing({ name: "Fruit salad" })).toEqual({ gramWeight: 175, label: "1 cup" });
  });

  it("keeps salad-word dishes distinct from their look-alikes", () => {
    // A chicken *salad sandwich* is still a sandwich; a *caesar salad* with
    // chicken is a salad; *salad dressing* is a dressing.
    expect(getTypicalServing({ name: "Chicken salad sandwich" })).toEqual({ gramWeight: 150, label: "1 sandwich" });
    expect(getTypicalServing({ name: "Chicken caesar salad" })).toEqual({ gramWeight: 100, label: "1 cup" });
    expect(getTypicalServing({ name: "Ranch salad dressing" })).toEqual({ gramWeight: 30, label: "2 tbsp" });
  });
});

describe("getSearchTypicalServing", () => {
  it("applies to per-100g local and USDA generic foods", () => {
    expect(getSearchTypicalServing({ name: "Apples, with skin", dataType: "local", servingSize: "100 g" }))
      .toEqual({ gramWeight: 182, label: "1 medium apple" });
    expect(getSearchTypicalServing({ name: "Broccoli, raw", dataType: "SR Legacy", servingSize: "100 g" }))
      .toEqual({ gramWeight: 91, label: "1 cup chopped" });
    expect(getSearchTypicalServing({ name: "Egg, whole, cooked, scrambled", dataType: "Survey (FNDDS)", servingSize: "100 g" }))
      .toEqual({ gramWeight: 50, label: "1 large egg" });
  });

  it("leaves branded foods and non-100g servings alone", () => {
    expect(getSearchTypicalServing({ name: "Cheddar cheese", dataType: "Branded", servingSize: "100 g" })).toBeNull();
    expect(getSearchTypicalServing({ name: "Cheddar cheese", dataType: "local", servingSize: "28 g" })).toBeNull();
    expect(getSearchTypicalServing({ name: "Cheddar cheese", servingSize: "100 g" })).toBeNull();
  });
});

describe("formatTypicalServingDisplay", () => {
  it("drops a leading count of 1 and appends the gram weight", () => {
    expect(formatTypicalServingDisplay({ gramWeight: 182, label: "1 medium apple" })).toBe("medium apple (182g)");
    expect(formatTypicalServingDisplay({ gramWeight: 86, label: "1/2 cup cooked" })).toBe("1/2 cup cooked (86g)");
    expect(formatTypicalServingDisplay({ gramWeight: 32, label: "2 tbsp" })).toBe("2 tbsp (32g)");
  });
});

describe("getFoodSearchCalorieDisplay with typical servings", () => {
  it("rescales per-100g generic foods to the typical serving", () => {
    const apple: Food = {
      id: 1, name: "Apples, with skin", brand: null, dataType: "local",
      servingSize: "100 g", calories: 52, protein: 0.3, carbs: 14, fat: 0.2,
    };
    expect(getFoodSearchCalorieDisplay(apple)).toEqual({ calories: 95, serving: "medium apple (182g)" });
  });

  it("keeps branded foods on their label serving", () => {
    const brandedCheese: Food = {
      id: 2, name: "Cheddar cheese", brand: "Tillamook", dataType: "Branded",
      servingSize: "100 g", calories: 403, protein: 23, carbs: 3, fat: 33,
    };
    expect(getFoodSearchCalorieDisplay(brandedCheese)).toEqual({ calories: 403, serving: "100 g" });
  });
});

describe("applyTypicalServing", () => {
  it("rescales nutrition and serving size for matching foods", () => {
    const apple: Food = {
      id: 1, name: "Apples, with skin", brand: null, dataType: "local",
      servingSize: "100 g", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, sodium: 1,
    };
    const scaled = applyTypicalServing(apple);
    expect(scaled.servingSize).toBe("medium apple (182g)");
    expect(scaled.calories).toBe(95);
    expect(scaled.carbs).toBeCloseTo(25.48, 2);
    expect(scaled.fiber).toBeCloseTo(4.368, 3);
  });

  it("returns the food unchanged when no rule applies", () => {
    const starfruit: Food = {
      id: 3, name: "Starfruit", brand: null, dataType: "local",
      servingSize: "100 g", calories: 31, protein: 1, carbs: 7, fat: 0.3,
    };
    expect(applyTypicalServing(starfruit)).toBe(starfruit);
  });
});

describe("toStorableFoodDetail", () => {
  const fullDetail: FoodDetail = {
    id: 173944,
    name: "Yogurt, Greek, plain, whole milk",
    brand: null,
    dataType: "SR Legacy",
    servingSize: null,
    householdServingFullText: null,
    labelNutrients: null,
    nutrients: { calories: 97, protein: 9, carbs: 3.9, fat: 5, fiber: 0, sodium: 35 },
    foodPortions: [
      { id: 1, amount: 1, gramWeight: 245, measureUnit: { name: "cup" } },
      { id: 2, amount: 1, gramWeight: 170, modifier: "container" },
    ],
    foodNutrients: [
      { nutrientName: "Energy", unitName: "kcal", amount: 97 },
      { nutrientName: "Protein", unitName: "g", amount: 9 },
      { nutrientName: "Vitamin B-12", unitName: "ug", amount: 0.75 },
    ],
  };

  it("keeps portions, label data, and the nutrients summary", () => {
    const stored = toStorableFoodDetail(fullDetail);
    expect(stored.foodPortions).toHaveLength(2);
    expect(stored.foodPortions?.[0].gramWeight).toBe(245);
    expect(stored.nutrients?.calories).toBe(97);
    expect(stored.dataType).toBe("SR Legacy");
  });

  it("replaces the full nutrient list with a single Energy entry", () => {
    const stored = toStorableFoodDetail(fullDetail);
    expect(stored.foodNutrients).toHaveLength(1);
    expect(stored.foodNutrients?.[0]).toEqual({ nutrientName: "Energy", unitName: "kcal", amount: 97 });
    // Portion calorie math reads energy per 100 units from the stored detail.
    expect(getEnergyCaloriesPer100Units(stored)).toBe(97);
  });

  it("stores an empty nutrient list when the detail has no kcal energy entry", () => {
    const stored = toStorableFoodDetail({ ...fullDetail, foodNutrients: [] });
    expect(stored.foodNutrients).toEqual([]);
  });

  it("keeps branded label serving fields used for calorie-per-serving math", () => {
    const branded = toStorableFoodDetail({
      ...fullDetail,
      dataType: "Branded",
      servingSize: "32",
      servingSizeUnit: "g",
      householdServingFullText: "2 tbsp",
      labelNutrients: { calories: { value: 190 } },
    });
    expect(branded.servingSize).toBe("32");
    expect(branded.servingSizeUnit).toBe("g");
    expect(branded.householdServingFullText).toBe("2 tbsp");
    expect(branded.labelNutrients?.calories?.value).toBe(190);
  });
});
