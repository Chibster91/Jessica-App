import { describe, expect, it } from "vitest";
import { parseFoodLogImportJson, buildImportDraft, normalizeMealName } from "./appSupport";

const eggDay = {
  date: "2026-06-01",
  meals: [
    {
      name: "Breakfast",
      foods: [
        { name: "Egg", serving: "1 large", servings: 2, calories: 78, macros: { protein: 6, carbs: 0.6, fat: 5 } },
      ],
    },
  ],
};

describe("parseFoodLogImportJson", () => {
  it("parses a single-day export with meals", () => {
    const result = parseFoodLogImportJson(eggDay);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.isMultiDay).toBe(false);
    expect(result.weightEntries).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      date: "2026-06-01",
      meal: "Breakfast",
      name: "Egg",
      serving: "1 large",
      quantity: "2",
      calories: "78",
      protein: "6",
      carbs: "0.6",
      fat: "5",
    });
  });

  it("parses a multi-day array and collects weight entries", () => {
    const result = parseFoodLogImportJson([
      eggDay,
      { date: "2026-06-02", weightEntry: { weight: 150, unit: "lb" }, meals: [] },
    ]);
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.isMultiDay).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(result.weightEntries).toHaveLength(1);
    expect(result.weightEntries[0]).toMatchObject({ date: "2026-06-02", weightLb: 150 });
  });

  it("parses the flat single-meal shape with items", () => {
    const result = parseFoodLogImportJson({
      date: "2026-06-01",
      meal: "Lunch",
      items: [{ name: "Apple", serving: "1 medium", calories: 95 }],
    });
    if (!result.ok) throw new Error(result.errors.join("; "));
    expect(result.items[0]).toMatchObject({ meal: "Lunch", name: "Apple", quantity: "1", protein: "0" });
  });

  it("rejects malformed dates, including impossible calendar days", () => {
    const bad = parseFoodLogImportJson({ ...eggDay, date: "06/01/2026" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join(" ")).toContain("date must be YYYY-MM-DD");

    const impossible = parseFoodLogImportJson({ ...eggDay, date: "2026-02-30" });
    expect(impossible.ok).toBe(false);
  });

  it("rejects files with no food items or weight entries", () => {
    const result = parseFoodLogImportJson({ date: "2026-06-01", meals: [] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toContain("Import file must include at least one food item or weight entry.");
  });

  it("rejects non-object input", () => {
    const result = parseFoodLogImportJson("not json");
    expect(result.ok).toBe(false);
  });

  it("rejects negative calories via draft validation", () => {
    const result = parseFoodLogImportJson({
      date: "2026-06-01",
      meal: "Lunch",
      items: [{ name: "Apple", serving: "1 medium", calories: -5 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(" ")).toContain("calories must be a non-negative number");
  });
});

describe("buildImportDraft", () => {
  it("reads aliased field names and defaults quantity to 1", () => {
    const draft = buildImportDraft("2026-06-01", "Dinner", {
      foodName: "Rice",
      portion: "1 cup",
      kcal: 200,
      carbohydrates: 45,
    });
    expect(draft).toMatchObject({
      date: "2026-06-01",
      meal: "Dinner",
      name: "Rice",
      serving: "1 cup",
      quantity: "1",
      calories: "200",
      carbs: "45",
      protein: "0",
      fat: "0",
    });
  });

  it("prefers top-level macro fields over the macros object", () => {
    const draft = buildImportDraft("2026-06-01", "Dinner", {
      name: "Rice",
      serving: "1 cup",
      calories: 200,
      protein: 5,
      macros: { protein: 4 },
    });
    expect(draft?.protein).toBe("5");
  });

  it("returns null for non-object items", () => {
    expect(buildImportDraft("2026-06-01", "Dinner", "Rice")).toBeNull();
    expect(buildImportDraft("2026-06-01", "Dinner", null)).toBeNull();
  });
});

describe("normalizeMealName", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeMealName("  Lunch   Time ")).toBe("Lunch Time");
  });
});
