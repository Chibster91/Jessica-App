import { test } from "node:test";
import assert from "node:assert/strict";
import { modalNutrition, deviates } from "../src/modal.mjs";
import { nutritionKey, round5, fingerprintOf, groupKeyOf } from "../src/fingerprint.mjs";

const row = (calories, quality = 7, extra = {}) => ({
  nutrition: { calories, protein: 0, carbs: calories / 4, fat: 0, ...extra },
  quality,
  publicationDate: "2024-01-01",
});

test("majority vote wins over outliers", () => {
  const rows = [row(42), row(42), row(42), row(139)]; // one wrong row
  const result = modalNutrition(rows);
  assert.equal(result.nutrition.calories, 42);
  assert.equal(result.deviantCount, 1);
});

test("flags groups where >10% of rows disagree", () => {
  const rows = [row(42), row(42), row(139)]; // 1/3 deviant
  assert.equal(modalNutrition(rows).flagged, true);
  const mostlyClean = [...Array(19)].map(() => row(42)).concat([row(139)]); // 5%
  assert.equal(modalNutrition(mostlyClean).flagged, false);
});

test("zero-calorie foods use the absolute floor, not percentages", () => {
  // Diet soda: modal 0 kcal. 3 kcal rows don't deviate (floor 5), 20 kcal rows do.
  assert.equal(deviates(3, 0), false);
  assert.equal(deviates(20, 0), true);
  const rows = [row(0), row(0), row(2)];
  assert.equal(modalNutrition(rows).flagged, false);
});

test("single-row groups never flag", () => {
  assert.equal(modalNutrition([row(250)]).flagged, false);
});

test("fingerprint rounding", () => {
  assert.equal(round5(42), 40);
  assert.equal(round5(43), 45);
  assert.equal(nutritionKey({ calories: 42, protein: 0.4, carbs: 10.6, fat: 0.2 }), "40|0|11|0");
  assert.equal(
    fingerprintOf("coca cola company", "diet coke", { calories: 0, protein: 0, carbs: 0, fat: 0 }),
    "coca cola company|diet coke|0|0|0|0"
  );
  assert.equal(groupKeyOf("coca cola company", "diet coke"), "coca cola company|diet coke");
});
