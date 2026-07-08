// OpenNutrition grocery names embed the brand as a " by <Brand>" suffix
// (e.g. "Hazelnut Spread by Nutella") instead of a separate column.
//
// Only applies to grocery-type rows: everyday/restaurant/prepared names have
// no brand and could legitimately contain the word "by". Splits on the LAST
// " by " so a product literally named "Cookies by the Sea by Nabisco" keeps
// "Cookies by the Sea" as the product name, not just "Cookies".

/**
 * @param {string} name
 * @param {string} foodType
 * @returns {{ productName: string, brand: string | null }}
 */
export function splitGroceryBrand(name, foodType) {
  const raw = String(name ?? "");
  if (foodType !== "grocery") return { productName: raw, brand: null };

  const idx = raw.lastIndexOf(" by ");
  if (idx === -1) return { productName: raw, brand: null };

  const productName = raw.slice(0, idx).trim();
  const brand = raw.slice(idx + 4).trim();
  if (!productName || !brand) return { productName: raw, brand: null };

  return { productName, brand };
}
