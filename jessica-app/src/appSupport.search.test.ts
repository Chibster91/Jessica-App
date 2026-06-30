import { describe, expect, it } from "vitest";
import { getFoodSearchScore, rankSearchResults, type Food } from "./appSupport";

// Minimal Food factory — only the fields getFoodSearchScore reads matter.
function food(overrides: Partial<Food>): Food {
  return {
    id: Math.floor(Math.random() * 1e9),
    name: "",
    brand: null,
    servingSize: "Details required",
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    ...overrides,
  };
}

const flagshipNutella = food({
  name: "HAZELNUT SPREAD WITH COCOA",
  brand: "FERRERO U.S.A., INC.",
  brandName: "Nutella",
  category: "Nut & Seed Butters",
  dataType: "Branded",
});

const comboNutella = food({
  name: "Nutella & GO! Hazelnut Spread + Pretzel Sticks",
  brand: "FERRERO U.S.A., INC.",
  brandName: "Nutella",
  category: "Cookies & Biscuits",
  dataType: "Branded",
});

describe("getFoodSearchScore — brand-intent (Task 5a)", () => {
  it("boosts a Branded food whose brandName equals the query", () => {
    const withBrandName = getFoodSearchScore(flagshipNutella, "nutella");
    const withoutBrandName = getFoodSearchScore(
      food({ ...flagshipNutella, brandName: null }),
      "nutella"
    );
    expect(withBrandName).toBeGreaterThan(withoutBrandName);
  });

  it("only fires brand-intent for Branded foods (same food as Foundation gets no +120)", () => {
    // Flagship name does not contain the brand word, so brand-stripping is a no-op for both;
    // the only difference is the Branded brand-intent bonus.
    const asFoundation = food({ ...flagshipNutella, dataType: "foundation" });
    expect(getFoodSearchScore(flagshipNutella, "nutella")).toBeGreaterThan(
      getFoodSearchScore(asFoundation, "nutella")
    );
  });

  it("regression: a generic query does not let a branded item outrank a Foundation whole food", () => {
    const foundationMilk = food({
      name: "Milk, whole, 3.25% milkfat, with added vitamin D",
      category: "Dairy and Egg Products",
      dataType: "sr legacy",
    });
    const brandNamedMilk = food({
      name: "MILK",
      brand: "Some Co",
      brandName: "Milk",
      category: "Milk",
      dataType: "Branded",
    });
    const ranked = rankSearchResults([brandNamedMilk, foundationMilk], "milk");
    expect(ranked[0]).toBe(foundationMilk);
  });
});

describe("getFoodSearchScore — combo penalty (Task 5b)", () => {
  it("ranks the clean flagship above a combo/bundle product for a brand query", () => {
    const ranked = rankSearchResults([comboNutella, flagshipNutella], "nutella");
    expect(ranked[0]).toBe(flagshipNutella);
  });

  it("penalises bundle signals (&, +, GO!) without touching a clean name", () => {
    expect(getFoodSearchScore(comboNutella, "nutella")).toBeLessThan(
      getFoodSearchScore(flagshipNutella, "nutella")
    );
  });

  it("does not penalise legitimate ' with ' descriptions", () => {
    // The flagship contains "WITH" — it must score as a clean (zero-combo-signal) name.
    const noWith = food({ ...flagshipNutella, name: "HAZELNUT SPREAD COCOA" });
    // Same length-ish names; the "with" variant should not be docked a combo penalty.
    const withScore = getFoodSearchScore(flagshipNutella, "nutella");
    const plainScore = getFoodSearchScore(noWith, "nutella");
    // Within the conciseness per-word delta (one extra word = -2), not a -20 combo hit.
    expect(Math.abs(withScore - plainScore)).toBeLessThanOrEqual(2);
  });
});

describe("getFoodSearchScore — conciseness tiebreaker (Task 5c)", () => {
  it("prefers the shorter name when other signals match", () => {
    const shortName = food({ name: "Greek Yogurt", brandName: "Chobani", dataType: "Branded" });
    const longName = food({
      name: "Greek Yogurt Nonfat Plain Family Size Value Tub Extra",
      brandName: "Chobani",
      dataType: "Branded",
    });
    expect(getFoodSearchScore(shortName, "greek yogurt")).toBeGreaterThan(
      getFoodSearchScore(longName, "greek yogurt")
    );
  });
});
