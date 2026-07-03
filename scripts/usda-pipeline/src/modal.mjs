// Modal (majority-vote) nutrition within a group of rows that share
// brand + normalized name. The most common rounded-nutrition bucket wins, so
// outlier/wrong rows lose. Groups with substantial disagreement are flagged
// for manual review — flagged, never dropped.

import { nutritionKey } from "./fingerprint.mjs";

/** Deviation tolerance vs the modal calories: 10% relative, with a 5 kcal
 * floor so zero-calorie foods (diet soda) don't flag on trivia. */
export function deviates(kcal, modalKcal) {
  return Math.abs(kcal - modalKcal) > Math.max(modalKcal * 0.1, 5);
}

/**
 * @param {Array<{nutrition: object, quality: number, publicationDate: string}>} rows
 * @returns {{ nutrition: object, modalCount: number, deviantCount: number, flagged: boolean }}
 */
export function modalNutrition(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const key = nutritionKey(row.nutrition);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  // Winner: largest bucket; ties broken by best quality inside the bucket.
  let winner = null;
  for (const bucket of buckets.values()) {
    if (
      !winner ||
      bucket.length > winner.length ||
      (bucket.length === winner.length && bestQuality(bucket) > bestQuality(winner))
    ) {
      winner = bucket;
    }
  }

  // Median of the winning bucket (its rows agree within rounding; median
  // shrugs off residual noise without inventing values).
  const nutrition = medianNutrition(winner.map((row) => row.nutrition));

  const deviantCount = rows.filter((row) => deviates(row.nutrition.calories, nutrition.calories)).length;
  // Flag when more than 10% of the group's rows disagree with the modal kcal
  // (and there is actually more than one row to disagree).
  const flagged = rows.length > 1 && deviantCount / rows.length > 0.1;

  return { nutrition, modalCount: winner.length, deviantCount, flagged };
}

function bestQuality(bucket) {
  return Math.max(...bucket.map((row) => row.quality ?? 0));
}

const NUTRIENT_FIELDS = ["calories", "protein", "carbs", "fat", "fiber", "sodium", "sugars"];

function medianNutrition(list) {
  const out = {};
  for (const field of NUTRIENT_FIELDS) {
    const values = list.map((n) => n[field]).filter((v) => v !== undefined && v !== null && Number.isFinite(v));
    out[field] = values.length > 0 ? median(values) : undefined;
  }
  return out;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return Math.round(value * 100) / 100;
}
