// Bulk nutrient amounts (USDA branded rows, OpenNutrition's nutrition_100g)
// are per 100 g/ml; this says which. Rows whose basis is anything else are
// counted and skipped by the caller.

export function validBasis(servingSizeUnit) {
  const u = String(servingSizeUnit ?? "").trim().toLowerCase();
  if (u === "g" || u === "grm" || u === "gram" || u === "grams") return "g";
  if (u === "ml" || u === "mlt" || u === "milliliter" || u === "milliliters") return "ml";
  return null;
}
