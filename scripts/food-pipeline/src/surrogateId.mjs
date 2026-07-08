// Deterministic surrogate integer IDs for datasets (like OpenNutrition) whose
// native ids aren't numeric. `foods.fdc_id` must stay a positive integer:
// the client's `Food.id` is a number, and custom/recipe foods use negative
// ids specifically to stay distinct from these. It also must never collide
// with a real USDA FDC id (this codebase's own examples top out around
// 754304 / 331960) so a stale pre-cutover reference can only ever miss
// cleanly, never resolve to a different product.
//
// A naive hash into full positive-32-bit space is NOT collision-safe at this
// scale: ~326,000 ids into ~2.1B slots gives ~25 expected birthday-paradox
// collisions. So callers must track assigned ids and probe on collision.

export const SURROGATE_ID_FLOOR = 100_000_000;
const SURROGATE_ID_CEILING = 0xffffffff; // stays within a 32-bit unsigned range

/** FNV-1a 32-bit hash, deterministic across runs/platforms. */
export function fnv1aHash(value) {
  let hash = 0x811c9dc5;
  const str = String(value);
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hashToRange(hash) {
  const span = SURROGATE_ID_CEILING - SURROGATE_ID_FLOOR + 1;
  return SURROGATE_ID_FLOOR + (hash % span);
}

/**
 * Assigns a collision-safe surrogate id for `sourceId`, recording it in
 * `taken`. Deterministic: the same `sourceId` processed against the same
 * prior `taken` state always yields the same id, so re-running ingestion in
 * a stable sort order keeps re-loads idempotent (same product keeps its id).
 * @param {Set<number>} taken - ids already assigned this run; mutated.
 * @param {string} sourceId
 * @returns {number}
 */
export function assignSurrogateId(taken, sourceId) {
  let candidate = hashToRange(fnv1aHash(sourceId));
  const span = SURROGATE_ID_CEILING - SURROGATE_ID_FLOOR + 1;
  let probes = 0;
  while (taken.has(candidate)) {
    probes++;
    if (probes > span) throw new Error("surrogate id space exhausted — this should be practically impossible");
    candidate = candidate + 1 > SURROGATE_ID_CEILING ? SURROGATE_ID_FLOOR : candidate + 1;
  }
  taken.add(candidate);
  return candidate;
}
