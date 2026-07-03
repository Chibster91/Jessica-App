import { describe, expect, it } from "vitest";
import { getFoodSearchScore, rankSearchResults, matchesLocalFoodQuery, type Food } from "./appSupport";

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

describe("getFoodSearchScore — whole-word matching", () => {
  it("does not credit substring matches inside longer words", () => {
    const rice = food({ name: "Rice, white, cooked", dataType: "sr legacy" });
    const juice = food({ name: "Juice, orange, raw", dataType: "sr legacy" });

    expect(getFoodSearchScore(rice, "rice")).toBeGreaterThan(getFoodSearchScore(juice, "rice"));
    // "rice" appears in "juice" only as a substring — no whole-word credit at all.
    expect(getFoodSearchScore(juice, "rice")).toBeLessThan(0);
  });

  it("tolerates singular/plural differences", () => {
    const eggs = food({ name: "Eggs, Grade A, Large", dataType: "foundation" });
    const unrelated = food({ name: "Oatmeal, plain", dataType: "foundation" });

    expect(getFoodSearchScore(eggs, "egg")).toBeGreaterThan(getFoodSearchScore(unrelated, "egg"));
    expect(getFoodSearchScore(eggs, "egg")).toBeGreaterThan(100);
  });

  it("still collapses multi-word brand spellings via compact matching", () => {
    const cheezIt = food({ name: "CHEEZ-IT Baked Snack Crackers", brand: "Kellogg", dataType: "Branded" });

    expect(getFoodSearchScore(cheezIt, "cheez it")).toBeGreaterThan(100);
  });

  it("keeps the real whole food above unrelated partial-word matches", () => {
    const wholeMilk = food({ name: "Milk, whole, 3.25% milkfat", dataType: "foundation" });
    const milkshake = food({ name: "Buttermilk biscuit mix", dataType: "Branded", brand: "Some Co" });

    const ranked = rankSearchResults([milkshake, wholeMilk], "milk");
    expect(ranked[0]).toBe(wholeMilk);
  });
});

describe("matchesLocalFoodQuery — typo tolerance without short-word collisions", () => {
  it("does not match brand searches against look-alike 4-letter whole foods", () => {
    // Regression: "coke"↔"cake" and "coca"↔"cola" were matching, which hijacked
    // the search away from USDA-branded sodas toward the local DB.
    expect(matchesLocalFoodQuery("Cake flour", "Baking", "coke")).toBe(false);
    expect(matchesLocalFoodQuery("Soda, cola", "Beverages", "coca cola")).toBe(false);
    expect(matchesLocalFoodQuery("Beets", "Vegetables", "beef")).toBe(false);
  });

  it("still matches exact, prefix, and substring queries", () => {
    expect(matchesLocalFoodQuery("Soda, cola", "Beverages", "cola")).toBe(true);
    expect(matchesLocalFoodQuery("Chocolate milk, whole", "Dairy", "choc")).toBe(true);
    expect(matchesLocalFoodQuery("Broccoli", "Vegetables", "broccoli")).toBe(true);
  });

  it("keeps typo tolerance for 5+ letter words", () => {
    expect(matchesLocalFoodQuery("Broccoli", "Vegetables", "brocoli")).toBe(true);
    expect(matchesLocalFoodQuery("Spinach", "Vegetables", "spinch")).toBe(true);
    expect(matchesLocalFoodQuery("Tomato, roma", "Vegetables", "tomatoe")).toBe(true);
  });
});

describe("getFoodSearchScore — manufacturer-name clutter and broader brand-intent", () => {
  const brandedCoke = food({
    name: "Coca-Cola",
    brand: "The Coca-Cola Company",
    brandName: "Coca-Cola",
    category: "Soda",
    dataType: "Branded",
  });
  const dasani = food({
    name: "Beverages, The COCA-COLA company, DASANI, water, bottled, non-carbonated",
    category: "Beverages",
    dataType: "sr legacy",
  });

  it("generic entries naming their manufacturer lose to the actual brand product", () => {
    const ranked = rankSearchResults([dasani, brandedCoke], "coca cola");
    expect(ranked[0]).toBe(brandedCoke);
    // The DASANI entry gets no whole-phrase credit for "coca cola" at all.
    expect(getFoodSearchScore(dasani, "coca cola")).toBeLessThan(100);
  });

  it("manufacturer stripping does not hurt the entry's own product words", () => {
    expect(getFoodSearchScore(dasani, "dasani water")).toBeGreaterThan(150);
  });

  it("brand-intent fires on the worker's D1 brandMatch hint", () => {
    const hinted = food({ ...brandedCoke, brandMatch: true });
    expect(getFoodSearchScore(hinted, "coke zero")).toBeGreaterThan(
      getFoodSearchScore(brandedCoke, "coke zero")
    );
  });

  it("brand-intent fires when the query contains the brand as a phrase", () => {
    const cherry = food({ ...brandedCoke, name: "Cherry Coca-Cola" });
    expect(getFoodSearchScore(cherry, "coca cola cherry")).toBeGreaterThan(200);
  });

  it("brand-intent fires via brand synonyms (coke → coca cola)", () => {
    expect(getFoodSearchScore(brandedCoke, "coke")).toBeGreaterThan(150);
  });
});
