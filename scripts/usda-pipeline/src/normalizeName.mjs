// Name normalization for grouping. Strips packaging/size tokens ("12 fl oz",
// "2 liters", "6 pack") and container words (bottle, can, ...) but CAPTURES
// them — stripped sizes become serving-size options on the canonical entry.
// The original name is always kept; the normalized name is used only for
// grouping and search tokens.

const SIZE_UNIT_PATTERN =
  "fl\\s*\\.?\\s*oz|fluid\\s+ounces?|ounces?|oz|liters?|litres?|l|milliliters?|ml|kilograms?|kg|grams?|g|pounds?|lbs?|packs?|pk|ct|count|pieces?|pcs?";

// number + unit, e.g. "12 fl oz", "1.25 liters", "355ml", "12-pack"
const SIZE_TOKEN_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*[- ]?\\s*(${SIZE_UNIT_PATTERN})\\b\\.?`, "gi");
// count multiplier before another number, e.g. the "12 x" in "12 x 355 ml"
const MULTIPLIER_RE = /\b(\d+)\s*[x×]\s*(?=\d)/gi;

const CONTAINER_WORDS = new Set([
  "bottle", "bottles", "can", "cans", "jug", "jugs", "box", "boxes", "case", "cases", "pouch", "pouches",
]);

const COUNT_UNITS = new Set(["pack", "packs", "pk", "ct", "count", "piece", "pieces", "pc", "pcs"]);

function canonicalUnit(rawUnit) {
  const u = rawUnit.toLowerCase().replace(/\s+/g, " ").replace(/\./g, "").trim();
  if (/^fl\s?oz$|^fluid ounces?$/.test(u)) return "fl oz";
  if (/^ounces?$|^oz$/.test(u)) return "oz";
  if (/^liters?$|^litres?$|^l$/.test(u)) return "liter";
  if (/^milliliters?$|^ml$/.test(u)) return "ml";
  if (/^kilograms?$|^kg$/.test(u)) return "kg";
  if (/^grams?$|^g$/.test(u)) return "g";
  if (/^pounds?$|^lbs?$/.test(u)) return "lb";
  if (COUNT_UNITS.has(u)) return "count";
  return u;
}

/**
 * @param {string} name original product description
 * @returns {{ normalized: string, packageSizes: {amount:number, unit:string}[], containers: string[] }}
 */
export function normalizeName(name) {
  const lower = String(name ?? "").toLowerCase();
  const packageSizes = [];
  const containers = [];

  // Multipliers first ("12 x 355 ml" -> "355 ml"), then size tokens — the
  // other order leaves a stray "x" behind once the trailing number is gone.
  let stripped = lower.replace(MULTIPLIER_RE, " ");

  stripped = stripped.replace(SIZE_TOKEN_RE, (_, amountText, unitText) => {
    const amount = Number(amountText);
    const unit = canonicalUnit(unitText);
    if (Number.isFinite(amount) && amount > 0 && unit !== "count") {
      packageSizes.push({ amount, unit });
    }
    return " ";
  });

  // Punctuation -> spaces, then drop container words and leftover bare numbers
  // ("12" left behind by "12 pack" spellings the size regex didn't own).
  const words = stripped
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => {
      if (CONTAINER_WORDS.has(word)) {
        containers.push(word.replace(/s$/, ""));
        return false;
      }
      // Bare numbers and stray multiplier "x"s are packaging leftovers.
      return !/^\d+$/.test(word) && word !== "x";
    });

  return { normalized: words.join(" "), packageSizes, containers };
}

const CONTAINER_WORD_RE = new RegExp(`\\b(${[...CONTAINER_WORDS].join("|")})\\b`, "gi");

/**
 * Case-preserving display name for the canonical entry: the representative's
 * original name minus packaging ("Coca-Cola Bottle, 2 Liters" -> "Coca-Cola").
 * The untouched original is still kept alongside for review.
 */
export function displayName(name) {
  const cleaned = String(name ?? "")
    .replace(MULTIPLIER_RE, " ")
    .replace(SIZE_TOKEN_RE, " ")
    .replace(CONTAINER_WORD_RE, " ")
    .replace(/\b\d+\b/g, " ")
    .replace(/\b[x×]\b/gi, " ")
    .replace(/\s*,\s*(?=,|$)/g, "") // empty comma segments
    .replace(/\s+,/g, ",")
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,\-–]+|[\s,\-–]+$/g, "")
    .trim();
  return cleaned || String(name ?? "").trim();
}
