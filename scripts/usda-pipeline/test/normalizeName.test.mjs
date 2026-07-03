import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeName } from "../src/normalizeName.mjs";

test("strips size + container tokens and captures them", () => {
  const r = normalizeName("Coca-Cola 12 Fl Oz Cans, 12 Pack");
  assert.equal(r.normalized, "coca cola");
  assert.deepEqual(r.packageSizes, [{ amount: 12, unit: "fl oz" }]);
  assert.deepEqual(r.containers, ["can"]);
});

test("liters and bottles", () => {
  const r = normalizeName("Diet Coke Bottle, 2 Liters");
  assert.equal(r.normalized, "diet coke");
  assert.deepEqual(r.packageSizes, [{ amount: 2, unit: "liter" }]);
  assert.deepEqual(r.containers, ["bottle"]);
});

test("multiplier packs collapse", () => {
  const r = normalizeName("Sparkling Water, 12 x 355 mL Cans");
  assert.equal(r.normalized, "sparkling water");
  assert.deepEqual(r.packageSizes, [{ amount: 355, unit: "ml" }]);
});

test("plain foods pass through", () => {
  const r = normalizeName("HAZELNUT SPREAD WITH COCOA");
  assert.equal(r.normalized, "hazelnut spread with cocoa");
  assert.deepEqual(r.packageSizes, []);
});

test("count units are stripped but not treated as sizes", () => {
  const r = normalizeName("String Cheese, 24 ct");
  assert.equal(r.normalized, "string cheese");
  assert.deepEqual(r.packageSizes, []);
});

test("does not eat food words containing unit letters", () => {
  // "granola" contains "g" and "l" but no digit prefix — untouched.
  assert.equal(normalizeName("Granola Clusters").normalized, "granola clusters");
});

test("displayName strips packaging with casing preserved", async () => {
  const { displayName } = await import("../src/normalizeName.mjs");
  assert.equal(displayName("Coca-Cola Bottle, 2 Liters"), "Coca-Cola");
  assert.equal(displayName("Diet Coke Can, 12 fl oz"), "Diet Coke");
  assert.equal(displayName("HAZELNUT SPREAD WITH COCOA"), "HAZELNUT SPREAD WITH COCOA");
  assert.equal(displayName("Sparkling Water, 12 x 355 mL Cans"), "Sparkling Water");
});
