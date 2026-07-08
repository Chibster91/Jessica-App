// End-to-end fixture run: executes run.mjs against test/fixtures/opennutrition.tsv
// and asserts the canonical output matches hand-computed expectations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = mkdtempSync(join(tmpdir(), "food-pipeline-data-"));
mkdirSync(dataDir, { recursive: true });
copyFileSync(join(here, "fixtures/opennutrition.tsv"), join(dataDir, "opennutrition_foods.tsv"));

function run(extraArgs = []) {
  const outDir = mkdtempSync(join(tmpdir(), "food-pipeline-out-"));
  execFileSync(process.execPath, [join(here, "../src/run.mjs"), "--data", dataDir, "--out", outDir, ...extraArgs], {
    encoding: "utf8",
  });
  const canonicals = readFileSync(join(outDir, "canonical-foods.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const summary = readFileSync(join(outDir, "summary.txt"), "utf8");
  return { canonicals, summary };
}

const { canonicals, summary } = run();

test("6 rows scanned, 1 dropped for incomplete macros, 5 canonical foods out", () => {
  assert.match(summary, /Rows scanned:\s+6\b/);
  assert.match(summary, /Dropped — incomplete macros:\s+1\b/);
  assert.equal(canonicals.length, 5);
});

test("sodium is pinned to a known real value (Morton iodized salt, mg not g)", () => {
  const salt = canonicals.find((c) => c.name === "Iodized Salt");
  assert.ok(salt, "expected the salt row to survive");
  assert.equal(salt.per100.sodium, 39300);
  assert.equal(salt.brandName, "Morton");
});

test("brand split: single ' by ' separates product from brand", () => {
  const salt = canonicals.find((c) => c.brandName === "Morton");
  assert.equal(salt.name, "Iodized Salt");
});

test("brand split: LAST ' by ' wins when it appears twice", () => {
  const cookies = canonicals.find((c) => c.brandName === "Nabisco");
  assert.ok(cookies, "expected the double-by cookies row to survive");
  assert.equal(cookies.name, "Cookies by the Sea");
});

test("brand split: no ' by ' in a grocery name leaves brand null", () => {
  const water = canonicals.find((c) => c.name === "Purified Water");
  assert.ok(water);
  assert.equal(water.brandOwner, null);
  assert.equal(water.brandName, null);
});

test("brand split: non-grocery types are never split, even with ' by ' in the name", () => {
  const dish = canonicals.find((c) => c.foodType === "restaurant");
  assert.ok(dish);
  assert.equal(dish.name, "Chicken Marinated by the Chef");
  assert.equal(dish.brandName, null);
});

test("everyday type carries through with no brand and no category", () => {
  const chicken = canonicals.find((c) => c.foodType === "everyday");
  assert.ok(chicken);
  assert.equal(chicken.brandName, null);
  assert.equal(chicken.category, null);
});

test("surrogate ids are all at or above the 100,000,000 floor", () => {
  for (const c of canonicals) assert.ok(c.fdcId >= 100_000_000, `${c.name} got fdcId ${c.fdcId}`);
});

test("household portion from `serving`, package portion from `package_size`", () => {
  const salt = canonicals.find((c) => c.name === "Iodized Salt");
  assert.equal(salt.portions[0].id, "household");
  assert.equal(salt.portions[0].measureUnit.name, "tsp");
  assert.equal(salt.portions[0].gramWeight, 6);
  const pkg = salt.portions.find((p) => p.id !== "household");
  assert.ok(pkg, "expected a package-size portion from package_size.common (26 oz)");
  assert.equal(pkg.measureUnit.name, "oz");
});

test("barcode carries through from ean_13", () => {
  const salt = canonicals.find((c) => c.name === "Iodized Salt");
  assert.equal(salt.barcode, "0033875000018");
});

test("--types filters by OpenNutrition type", () => {
  const { canonicals: groceryOnly, summary: filteredSummary } = run(["--types", "grocery"]);
  assert.match(filteredSummary, /Dropped — type filter:\s+2\b/); // everyday + restaurant rows
  assert.ok(groceryOnly.every((c) => c.foodType === "grocery"));
});
