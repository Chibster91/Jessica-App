import { test } from "node:test";
import assert from "node:assert/strict";
import { splitGroceryBrand } from "../src/brandSplit.mjs";

test("splits on ' by ' for grocery rows", () => {
  assert.deepEqual(splitGroceryBrand("Hazelnut Spread by Nutella", "grocery"), {
    productName: "Hazelnut Spread",
    brand: "Nutella",
  });
});

test("splits on the LAST ' by ' when it appears twice", () => {
  assert.deepEqual(splitGroceryBrand("Cookies by the Sea by Nabisco", "grocery"), {
    productName: "Cookies by the Sea",
    brand: "Nabisco",
  });
});

test("no ' by ' in a grocery name: null brand, full name kept", () => {
  assert.deepEqual(splitGroceryBrand("Purified Water", "grocery"), {
    productName: "Purified Water",
    brand: null,
  });
});

test("never splits non-grocery types even when the name contains ' by '", () => {
  assert.deepEqual(splitGroceryBrand("Chicken Marinated by the Chef", "restaurant"), {
    productName: "Chicken Marinated by the Chef",
    brand: null,
  });
});
