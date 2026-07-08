# USDA Search Audit — Report (read-only pass, no code changed)

Companion to `fable-usda-search-audit.md`. All line numbers verified against the current working tree (commit d386a1e).

---

## 1. Flow map — what actually happens when you search

**Typing & submit** — Search only fires when you press Enter or tap the Search button ([LogView.tsx:628-630](jessica-app/src/components/LogView.tsx:628)). There is no search-as-you-type. No spinner is shown while it runs.

**Client orchestration** — `searchModalFood()` ([useAddFoodModal.ts:167](jessica-app/src/hooks/useAddFoodModal.ts:167)) calls `searchFoodsGrouped()` ([search.ts:557](jessica-app/src/search.ts:557)), which builds three groups:

1. **My Foods** — custom foods + recipes matching the query.
2. **Whole Foods** — local `foods.json` (618 foods), fuzzy token match.
3. **Packaged (USDA)** — **only reached if BOTH:** the USDA toggle is on **and** the local DB returned zero matches ([search.ts:589](jessica-app/src/search.ts:589)).

When USDA does fire: the query plus any brand synonyms ([search.ts:18-53](jessica-app/src/search.ts:18)) each become a separate worker call, run in parallel; results are merged by `fdcId`, re-ranked client-side by `getFoodSearchScore()` ([search.ts:159](jessica-app/src/search.ts:159)), and cut to 15 ([search.ts:614](jessica-app/src/search.ts:614)).

**Worker** — `expandSearchRequests()` ([jessica-worker/src/index.ts:465](jessica-worker/src/index.ts:465)) fans each worker call out to 3–5 parallel USDA requests, all with `requireAllWords=true`, `pageSize=50`:
- Tier 1: Foundation + SR Legacy (one request), Survey/FNDDS (separate request so its empty-query 400 can't sink the others)
- Tier 2: Branded
- Extra Tier 2 requests when the query starts with one of 16 hardcoded brands ([index.ts:498-518](jessica-worker/src/index.ts:498)) or matches the creamer category heuristic ([index.ts:520-529](jessica-worker/src/index.ts:520))

Results are deduped by `fdcId` only, scored by `rankSearchResult()` + `nutritionQualityScore()` ([index.ts:548-617](jessica-worker/src/index.ts:548)), then capped by `applyTierCap()` ([index.ts:241](jessica-worker/src/index.ts:241)): **25 total, each tier guaranteed up to 10 slots**, Tier 1 gets leftovers first.

**Previews & detail** — The worker returns previews with `calories: 0` and `servingSize: "Details required"` ([index.ts:184-189](jessica-worker/src/index.ts:184)) even though the USDA search response already contains nutrient values (the worker reads them for quality scoring, then throws them away). The list row shows "select to load nutrition" ([nutrition.ts:597-604](jessica-app/src/nutrition.ts:597)) until you tap, which triggers `GET /detail` (cached: worker in-memory 6 h per isolate [index.ts:3,87], client session `Map` [search.ts:329]).

### Corrections to the "system context" in the audit prompt (ghost assumptions)

| Claim | Reality |
|---|---|
| "The only elimination mechanism is `slice(0, 15)` at worker and client" | **Wrong three ways.** (1) The worker cap is 25 with per-tier minimums, not a flat 15; the client cuts Packaged to 15. (2) Records without energy data are effectively buried (−500) and "Experimental" foods are hard-filtered ([index.ts:619](jessica-worker/src/index.ts:619)). (3) The biggest eliminator: **USDA is never called at all** when the local DB matches, or when the toggle is off. |
| USDA path is always available | **The toggle defaults to OFF** — `localStorage.getItem("usdaEnabled") === "1"` ([useAddFoodModal.ts:73](jessica-app/src/hooks/useAddFoodModal.ts:73)). On a new device or after clearing storage, USDA silently never fires. |
| Two-tier retrieval, Tier 1 strict | Correct, but **Tier 2 (Branded) is also strict** (`requireAllWords=true`, [index.ts:475](jessica-worker/src/index.ts:475)), and there are extra brand-owner/category fan-out requests beyond the two tiers. |
| Brand scoring reads `brandName`/`brandedFoodCategory`, not `brandOwner`/`foodCategory` | **Partially right.** Brand-*intent* uses `brandName` ([search.ts:175](jessica-app/src/search.ts:175)) and the worker merges `brandedFoodCategory ?? foodCategory` into one `category` field ([index.ts:181](jessica-worker/src/index.ts:181)). But several other bonuses still score against `brand` = `brandOwner` ([search.ts:210-211](jessica-app/src/search.ts:210)). |
| Oreo/SR-Legacy `requireAllWords` gap is known & synonym-mitigated | Confirmed. "oreo" has synonyms ([search.ts:21-22](jessica-app/src/search.ts:21)) that catch the generic SR Legacy entries. The gap remains for anything not in the ~30-entry synonym map. |
| Combo-penalty fix (Nutella & GO!) | Confirmed working as described: brand-word stripping [search.ts:179-182], graduated capped combo penalty [search.ts:149-157, 228-229], flagship category boost +150 [search.ts:224]. |

---

## 2. Findings

### HIGH

**H1. USDA previews show no calories until tapped — the worker throws away data it already has.**
Where: [index.ts:184-189](jessica-worker/src/index.ts:184) (zeros hardcoded), [nutrition.ts:597-604](jessica-app/src/nutrition.ts:597) ("select to load nutrition").
Why it hurts: you can't compare 15 results at a glance; picking the right yogurt means tap → wait for a detail round-trip → back out → tap the next one, on a phone. The USDA *search* response already carries per-100g nutrients (the worker counts them at [index.ts:591-596](jessica-worker/src/index.ts:591)) and, for Branded, `servingSize`/`servingSizeUnit` — it just doesn't map them into the preview.

**H2. Search failures are completely silent.**
Where: `searchModalFood()` has no try/catch, no loading state, no error state ([useAddFoodModal.ts:167-178](jessica-app/src/hooks/useAddFoodModal.ts:167)); `fetchUsdaFoods()` never checks `res.ok` ([search.ts:465-471](jessica-app/src/search.ts:465)), so a worker error body (`{error: …}`) becomes `[]` via `asFoodArray`; a network drop rejects an unhandled promise and the list simply doesn't change.
Why it hurts: on flaky mobile data, "no response" and "USDA is rate-limited" and "genuinely no matches" all look identical.

**H3. Zero results looks exactly like "you haven't searched yet."**
Where: [LogView.tsx:688-690](jessica-app/src/components/LogView.tsx:688) — the same placeholder text renders for both states. Combined with H2 and the double-gated USDA path (toggle off / local hit), an empty list gives you no clue *why* it's empty.

**H4. Strict-only retrieval with no fallback: one unmatched word = zero USDA results.**
Where: every fan-out request sets `requireAllWords=true` ([index.ts:472-475](jessica-worker/src/index.ts:472)); nothing retries loose when all tiers come back empty.
Why it hurts real recall: "grilled chicken breasts" (plural), a typo, or a descriptive extra word ("creamy peanut butter smooth") can each return nothing, when a loose pass would have found the food. The strictness is right as a *first* pass — the missing piece is a fallback.

### MEDIUM

**M1. No caching anywhere on the search path.**
Where: worker caches `/detail` only ([index.ts:87](jessica-worker/src/index.ts:87)); search responses aren't cached in the worker, carry no `Cache-Control` header ([index.ts:896-903](jessica-worker/src/index.ts:896)), and the client keeps no query→results cache. Repeating a search you did 30 seconds ago pays the full USDA round-trip (~1–2 s, bounded by the slowest of 3–5 parallel USDA calls).

**M2. Near-duplicate clutter: dedup is by `fdcId` only.**
Where: [index.ts:192-194](jessica-worker/src/index.ts:192). USDA's Branded set holds many records per product (data revisions, pack sizes, regional entries), and staples appear in both Foundation and SR Legacy ("Milk, whole, 3.25%…" twice). The nutrition-quality score sorts the good duplicate first but the rest still ride along, eating top-15 slots. The only name-level dedup is client-side against *local* foods ([search.ts:597-600](jessica-app/src/search.ts:597)), not USDA-vs-USDA.

**M3. Client scorer matches substrings, not words — unlike the worker.**
Where: `matchedNameWords`/`matchedSearchWords` use `.includes(word)` ([search.ts:186-187](jessica-app/src/search.ts:186)), and `searchableText.includes(queryText)` gives +130 ([search.ts:202](jessica-app/src/search.ts:202)). The worker correctly uses `\b` word boundaries ([index.ts:637-639](jessica-worker/src/index.ts:637)).
Why it hurts: the *client* ranking decides final order, and "ice" matches ju**ice**/r**ice**/sl**ice**d, "corn" matches pop**corn**, "milk" matches butter**milk**. Wrong items collect full-match bonuses and can shade out right ones on short queries.

**M4. No-energy records are buried (−500) but not removed.**
Where: [index.ts:612-616](jessica-worker/src/index.ts:612).
When a query returns few candidates, a record with no calorie data at all can still make the top 15 and display as 0 cal. Cutting is safe: `hasEnergyData` already treats a legitimate 0-kcal value (diet soda) as *having* energy data ([index.ts:601-608](jessica-worker/src/index.ts:601)) — only records missing the nutrient entirely would be dropped.

### LOW

**L1. USDA toggle defaults off** ([useAddFoodModal.ts:73](jessica-app/src/hooks/useAddFoodModal.ts:73)) — see ghost-assumption table. Works on your current phone only because you've flipped it at some point.
**L2. Local-hit suppression is invisible** ([search.ts:589](jessica-app/src/search.ts:589)) — intended design, but the UI never hints "USDA skipped because local matched; toggle to force it."
**L3. Group labels are computed then discarded** — `searchFoodsGrouped` builds "My Foods / Whole Foods / Packaged" labels but `searchModalFood` flattens them ([useAddFoodModal.ts:170-177](jessica-app/src/hooks/useAddFoodModal.ts:170)) and the modal renders one unlabeled list. Ordering survives; the context cue doesn't.
**L4. Hardcoded brand lists** — 16 brands in `getKnownBrandMatch` ([index.ts:498](jessica-worker/src/index.ts:498)), ~30 in `brandSynonyms` ([search.ts:18](jessica-app/src/search.ts:18)). Fine for one user; just know these are the only brands that get special help.
**L5. Empty query defaults to "egg"** ([index.ts:133](jessica-worker/src/index.ts:133)) — harmless quirk.
**L6. Synonym fan-out multiplies upstream calls** — "oreo" = 4 worker calls × 3 USDA requests = 12 upstream hits per search. Parallel, so latency is fine; rate limit (1,000/hr) is a non-issue solo. Noted, not a problem.
**L7. Worker detail cache is per-isolate memory** — evicted whenever Cloudflare recycles the isolate. Fine at this scale.

---

## 3. Prioritized polish plan

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | **Preview nutrition from the search response** — map search-result `foodNutrients` (+ Branded `servingSize`) into `WorkerFood` so every row shows calories immediately (fixes H1) | ★★★★ | Low-Med (worker mapping + client display; per-100g vs per-serving choice below) |
| 2 | **Search UX states** — spinner while searching, an error line on failure, a real "No results for 'X'" empty state; check `res.ok` in `fetchUsdaFoods` (fixes H2+H3) | ★★★★ | Low |
| 3 | **Loose-retry fallback in the worker** — if all strict tiers return zero foods, re-run once without `requireAllWords` (fixes H4; strict results still win when they exist) | ★★★ | Low |
| 4 | **Cache search results** — client `Map<query, results>` for the session + worker in-memory cache w/ TTL (~1 h) + `Cache-Control` header (fixes M1) | ★★★ | Low |
| 5 | **Cut no-energy records instead of burying** (fixes M4) | ★★ | Trivial |
| 6 | **Word-boundary matching in the client scorer** — align with the worker's `\b` approach (fixes M3) | ★★ | Low (needs care: keep the compact-name path for "cheezit"-style queries) |
| 7 | **USDA-vs-USDA name dedup** — collapse results whose normalized name+brand match, keeping the highest nutrition-quality record (fixes M2) | ★★ | Med |
| 8 | **Surface the gating** — small hint when USDA was skipped (toggle off / local hit), and/or render the group labels the code already computes (L2, L3) | ★ | Low |

Items 1–4 are the daily-use wins: results you can compare at a glance, honest feedback when something fails, no more mystery-empty lists, and instant repeat searches.

## 4. Open questions / decisions for Jessica

1. **Preview calories basis** — USDA search nutrients are per-100g for Branded. Show "per 100 g" in the list (honest, comparable) and switch to the label serving after tap? Or estimate per-serving in the preview using the search response's `servingSize` (Branded only — Foundation/Survey stay per-100g)? *My lean: per-serving where the data allows, per-100g otherwise, always labeled.*
2. **Loose fallback scope** — retry-on-zero only (my recommendation), or always run a loose Tier 2 request alongside strict? The latter improves recall slightly but re-invites the partial-match noise the strict setting was added to kill.
3. **Score floor** — I recommend **no** general minimum-score floor. The tier cap + ranking + the no-energy cut (plan #5) handle the tail; a floor risks hiding legitimate results on oddly-worded queries where every score is low. Revisit only if garbage still shows after #5–#7.
4. **Toggle default** — should USDA default ON for fresh installs? Local-first gating already prevents unnecessary calls, so the off-default mostly just creates the L1 trap.
5. **Dedup aggressiveness** (plan #7) — when Foundation and SR Legacy both have "Milk, whole": keep only Foundation (newer, lab-analyzed), or keep both? Keeping one is cleaner; keeping both preserves the occasional case where SR Legacy has better portion data.
