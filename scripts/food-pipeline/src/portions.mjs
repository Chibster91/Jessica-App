// Package sizes collapsed out of the duplicate rows become serving-size
// options on the canonical entry, shaped exactly like the app's FoodPortion
// ({ id, amount, measureUnit: { name }, gramWeight }) so the existing
// toPortionOption/getPortionLabel path renders "12 fl oz can" with zero
// frontend changes.

const ML_PER_FL_OZ = 29.5735;
const G_PER_OZ = 28.3495;
const G_PER_LB = 453.592;

/** Convert a captured {amount, unit} to the per-100 basis amount (g or ml).
 * Volume sizes only apply on an ml basis (liquids, density 1 assumed); weight
 * sizes only on a g basis — mixing the two would corrupt the math. */
export function sizeToBasisAmount(size, basisUnit) {
  const { amount, unit } = size;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  if (basisUnit === "ml") {
    if (unit === "fl oz") return amount * ML_PER_FL_OZ;
    if (unit === "liter") return amount * 1000;
    if (unit === "ml") return amount;
    return null;
  }
  if (basisUnit === "g") {
    if (unit === "oz") return amount * G_PER_OZ;
    if (unit === "lb") return amount * G_PER_LB;
    if (unit === "kg") return amount * 1000;
    if (unit === "g") return amount;
    return null;
  }
  return null;
}

const MIN_PORTION = 5; // ignore sub-5g/ml "sizes" (regex noise)
const MAX_PORTION = 6000; // and anything past 6 kg/L (bulk cases)
const MAX_PACKAGE_PORTIONS = 6;

/**
 * @param {Array<{packageSizes: {amount:number, unit:string}[], containers: string[]}>} groupRows
 * @param {"g"|"ml"} basisUnit
 * @param {{ householdServing?: string|null, servingSize?: number|null }} representative
 * @returns {Array<{id: string, amount: number|null, measureUnit: {name: string}, gramWeight: number}>}
 */
export function buildPortions(groupRows, basisUnit, representative) {
  const portions = [];

  // Label household serving first (e.g. "1 can (360 ml)"): the app treats the
  // first portion as the preferred one.
  const household = String(representative.householdServing ?? "").trim();
  const servingSize = representative.servingSize;
  if (household && Number.isFinite(servingSize) && servingSize > 0) {
    const parsed = household.match(/^([\d./]+)?\s*(.+)$/);
    const amount = parsed?.[1] ? parseAmount(parsed[1]) : null;
    const unitName = (parsed?.[2] ?? household).trim();
    portions.push({
      id: "household",
      amount: amount ?? 1,
      measureUnit: { name: unitName },
      gramWeight: round1dp(servingSize),
    });
  }

  // Package sizes from every collapsed row, deduped by rounded basis amount.
  const seen = new Set(portions.map((p) => Math.round(p.gramWeight)));
  const candidates = [];
  for (const row of groupRows) {
    const container = row.containers?.[0] ?? "";
    for (const size of row.packageSizes ?? []) {
      const basisAmount = sizeToBasisAmount(size, basisUnit);
      if (basisAmount === null || basisAmount < MIN_PORTION || basisAmount > MAX_PORTION) continue;
      const key = Math.round(basisAmount);
      if (seen.has(key)) continue;
      seen.add(key);
      const label = container ? `${size.unit} ${container}` : size.unit;
      candidates.push({
        id: `pkg-${key}${basisUnit}`,
        amount: size.amount,
        measureUnit: { name: label },
        gramWeight: round1dp(basisAmount),
      });
    }
  }

  candidates.sort((a, b) => a.gramWeight - b.gramWeight);
  portions.push(...candidates.slice(0, MAX_PACKAGE_PORTIONS));
  return portions;
}

function parseAmount(text) {
  const t = text.trim();
  if (t.includes("/")) {
    const [num, den] = t.split("/").map(Number);
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) return num / den;
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function round1dp(x) {
  return Math.round(x * 10) / 10;
}
