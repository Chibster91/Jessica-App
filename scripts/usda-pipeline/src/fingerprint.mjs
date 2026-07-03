// Nutrition fingerprinting. USDA branded bulk nutrient amounts are already
// per 100 g/ml (the label basis); serving_size_unit says which. Rows whose
// basis is anything else are counted and skipped by the caller.

export function validBasis(servingSizeUnit) {
  const u = String(servingSizeUnit ?? "").trim().toLowerCase();
  if (u === "g" || u === "grm" || u === "gram" || u === "grams") return "g";
  if (u === "ml" || u === "mlt" || u === "milliliter" || u === "milliliters") return "ml";
  return null;
}

export const round5 = (x) => Math.round(x / 5) * 5;
export const round1 = (x) => Math.round(x);

/** Nutrition part of the fingerprint: kcal to nearest 5, macros to nearest 1g. */
export function nutritionKey(n) {
  return `${round5(n.calories)}|${round1(n.protein)}|${round1(n.carbs)}|${round1(n.fat)}`;
}

/** Full fingerprint: brand + normalized name + rounded nutrition. */
export function fingerprintOf(brandOwnerNorm, normalizedName, nutrition) {
  return `${brandOwnerNorm}|${normalizedName}|${nutritionKey(nutrition)}`;
}

/** Group key: brand + normalized name (fingerprint minus nutrition), so rows of
 * the same product with slightly different nutrition land in one group and the
 * modal vote settles it. */
export function groupKeyOf(brandOwnerNorm, normalizedName) {
  return `${brandOwnerNorm}|${normalizedName}`;
}
