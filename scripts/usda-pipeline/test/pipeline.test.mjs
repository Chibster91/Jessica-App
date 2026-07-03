// End-to-end fixture run: executes run.mjs against test/fixtures and asserts
// the canonical output and summary counts match hand-computed expectations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), "usda-pipeline-test-"));

execFileSync(process.execPath, [join(here, "../src/run.mjs"), "--data", join(here, "fixtures"), "--out", outDir], {
  encoding: "utf8",
});

const canonicals = readFileSync(join(outDir, "canonical-foods.ndjson"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const flagged = readFileSync(join(outDir, "flagged-groups.ndjson"), "utf8").split("\n").filter(Boolean).map(JSON.parse);
const summary = readFileSync(join(outDir, "summary.txt"), "utf8");

test("group counts: 8 assembled rows collapse to 4 canonical foods", () => {
  assert.equal(canonicals.length, 4);
  assert.match(summary, /Rows assembled:\s+8\b/);
  assert.match(summary, /Canonical foods \(groups out\):\s+4\b/);
});

test("filters: discontinued, non-US, and incomplete-macro rows are dropped", () => {
  assert.match(summary, /Dropped — discontinued:\s+1\b/);
  assert.match(summary, /Dropped — non-US market:\s+1\b/);
  assert.match(summary, /Dropped — incomplete macros:\s+1\b/);
});

test("modal vote: Coca-Cola group keeps 42 kcal despite the 139-kcal outlier", () => {
  const coke = canonicals.find((c) => c.groupSize === 4);
  assert.ok(coke, "expected a 4-row Coca-Cola group");
  assert.equal(coke.per100.calories, 42);
  assert.equal(coke.flagged, true);
  assert.equal(flagged.length, 1);
  assert.equal(flagged[0].members.length, 4);
});

test("representative: most complete nutrients wins (fdc 1001, sodium+sugars present)", () => {
  const coke = canonicals.find((c) => c.groupSize === 4);
  assert.equal(coke.fdcId, 1001);
  assert.equal(coke.brandName, "Coca-Cola");
});

test("portions: household first, then package sizes from all collapsed rows", () => {
  const coke = canonicals.find((c) => c.groupSize === 4);
  assert.equal(coke.portions[0].id, "household");
  assert.equal(coke.portions[0].gramWeight, 360);
  const labels = coke.portions.slice(1).map((p) => `${p.amount} ${p.measureUnit.name}`);
  assert.deepEqual(labels, ["12 fl oz can", "20 fl oz bottle", "2 liter bottle"]);
});

test("diet coke groups separately with 0 kcal, unflagged", () => {
  const diet = canonicals.find((c) => c.brandName === "Diet Coke");
  assert.ok(diet);
  assert.equal(diet.groupSize, 2);
  assert.equal(diet.per100.calories, 0);
  assert.equal(diet.flagged, false);
});

test("tokens cover name and brand words", () => {
  const nutella = canonicals.find((c) => c.brandName === "Nutella");
  assert.ok(nutella.tokens.includes("hazelnut"));
  assert.ok(nutella.tokens.includes("nutella"));
  assert.ok(nutella.tokens.includes("ferrero"));
});
