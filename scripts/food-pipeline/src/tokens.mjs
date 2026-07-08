// Search-token extraction for the D1 inverted index. Mirrors the worker's
// normalizeSearchForMatching (lowercase, non-alphanumeric -> space) and
// getSearchWords (words of length > 1), so worker queries and index tokens
// tokenize identically.

const MAX_TOKENS_PER_FOOD = 16;

export function normalizeForMatching(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Tokens come from the normalized (packaging-stripped) name plus brand fields
 * and category — pure numbers are dropped (package sizes aren't searchable).
 */
export function extractTokens({ normalizedName, brandName, brandOwner, category }) {
  const tokens = new Set();
  for (const source of [normalizedName, brandName, brandOwner, category]) {
    for (const word of normalizeForMatching(source).split(/\s+/)) {
      if (word.length > 1 && !/^\d+$/.test(word)) tokens.add(word);
      if (tokens.size >= MAX_TOKENS_PER_FOOD) return [...tokens];
    }
  }
  return [...tokens];
}
