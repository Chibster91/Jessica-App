import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPortions, sizeToBasisAmount } from "../src/portions.mjs";

test("fl oz and liters convert to ml on a liquid basis", () => {
  assert.equal(Math.round(sizeToBasisAmount({ amount: 12, unit: "fl oz" }, "ml")), 355);
  assert.equal(sizeToBasisAmount({ amount: 2, unit: "liter" }, "ml"), 2000);
});

test("weight sizes convert on a gram basis", () => {
  assert.equal(Math.round(sizeToBasisAmount({ amount: 1, unit: "lb" }, "g")), 454);
  assert.equal(Math.round(sizeToBasisAmount({ amount: 8, unit: "oz" }, "g")), 227);
});

test("volume sizes are rejected on a gram basis and vice versa", () => {
  assert.equal(sizeToBasisAmount({ amount: 12, unit: "fl oz" }, "g"), null);
  assert.equal(sizeToBasisAmount({ amount: 8, unit: "oz" }, "ml"), null);
});

test("household serving comes first, package sizes deduped and sorted", () => {
  const rows = [
    { packageSizes: [{ amount: 12, unit: "fl oz" }], containers: ["can"] },
    { packageSizes: [{ amount: 12, unit: "fl oz" }], containers: ["can"] }, // duplicate
    { packageSizes: [{ amount: 2, unit: "liter" }], containers: ["bottle"] },
    { packageSizes: [{ amount: 20, unit: "fl oz" }], containers: ["bottle"] },
  ];
  const portions = buildPortions(rows, "ml", { householdServing: "1 can", servingSize: 360 });

  assert.equal(portions[0].id, "household");
  assert.equal(portions[0].measureUnit.name, "can");
  assert.equal(portions[0].gramWeight, 360);

  const rest = portions.slice(1);
  assert.deepEqual(
    rest.map((p) => ({ label: `${p.amount} ${p.measureUnit.name}`, g: Math.round(p.gramWeight) })),
    [
      { label: "12 fl oz can", g: 355 },
      { label: "20 fl oz bottle", g: 592 },
      { label: "2 liter bottle", g: 2000 },
    ]
  );
});

test("absurd sizes are dropped", () => {
  const rows = [{ packageSizes: [{ amount: 0.05, unit: "fl oz" }, { amount: 400, unit: "liter" }], containers: [] }];
  assert.deepEqual(buildPortions(rows, "ml", {}), []);
});
