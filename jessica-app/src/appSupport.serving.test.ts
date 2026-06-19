import { describe, expect, it } from "vitest";
import {
  parseServingSize,
  getMeasuredServingBasis,
  getFoodDensity,
  convertAmountToBasisUnit,
  getScaleFromServingBasis,
  parseIngredientAmount,
  ingredientServingsFromAmount,
  scaleFoodNutrition,
  parseDecimalInput,
  getItemCalories,
  getLogCategoryTotals,
  type Food,
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
