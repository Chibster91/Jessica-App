# Audit: USDA Search — Full Analysis & Polish Plan

## Objective
Do a complete, read-only analysis of the USDA food search system (worker proxy + client-side retrieval/ranking) and produce a prioritized plan to polish it for real daily use. **This pass is analysis + recommendations only. Do NOT change code until I approve the plan.**

## globalRules
- **RECON FIRST, NO OOPSIES.** Read the code, map the actual flow, report findings. No edits this pass.
- Ground every claim in the real code — cite file:line. If you're inferring behavior, say so explicitly rather than assuming.
- Judge against my actual use case: solo user, mobile (Galaxy S22 Ultra), logging real foods fast, hating USDA's noise. "Polish for actual use" = fewer wrong results, better ranking, faster, cleaner names — not theoretical completeness.
- Flag ghost assumptions. If I've told you the architecture works a certain way and the code disagrees, tell me.

## System context (verify against code — don't take as gospel)
The USDA path is believed to work like this — confirm or correct each point:
- Cloudflare Worker proxy (`jessica-worker`) sits between client and USDA FoodData Central API; prod API key is a Worker secret.
- **Two-tier retrieval:** Tier 1 = Foundation / SR Legacy / Survey with `requireAllWords=true`. Tier 2 = Branded, with brand-intent scoring, combo-name penalties, and brand-word stripping before name-position bonuses.
- A prior ranking bug where combo products (e.g. "Nutella & GO!") outranked the plain product was fixed via that Tier 2 scoring.
- Brand scoring reads `brandName` and `brandedFoodCategory` (NOT `brandOwner` / `foodCategory`).
- **The only elimination mechanism is `slice(0, 15)`** at the worker and client layers — there is NO score-threshold filter. Everything that gets retrieved is eligible to surface; only rank + the top-15 cut decide what I see.
- Known limitation: `requireAllWords=true` misses some SR Legacy items (e.g. Oreo) unless a synonym fan-out catches them — believed intentional/deferred, not a regression.

## Analysis areas — cover each
1. **Recall** — What legitimate foods get missed and why? Assess the `requireAllWords` tradeoff, synonym fan-out coverage, single vs multi-word queries. Where does the two-tier split help vs hurt?
2. **Ranking quality** — Does the best result land in the top 3 for typical queries? Stress-test brand-intent scoring, combo penalties, and name-position bonuses against realistic queries (plain staples, branded items, ambiguous terms). Where does a worse result outrank a better one?
3. **The hard `slice(0, 15)` cut** — With no score threshold, is garbage riding along in the top 15? Would a minimum-score floor, or a relevance gap cutoff, clean up the tail without hiding good results? Quantify the risk both ways.
4. **Deduplication** — USDA returns near-identical entries (same food, multiple data types / brands). Is there any dedup? What collapsing strategy would reduce clutter?
5. **Latency & caching** — Round-trip cost through the Worker, any client/worker caching, redundant calls. What's the cheapest win for perceived speed on mobile?
6. **Data quality / presentation** — ALL-CAPS names, serving-size normalization, per-100g vs per-serving consistency, missing macros. What cleanup makes results usable at a glance?
7. **Failure modes** — Empty results, network errors, rate limits, malformed USDA payloads. How are they surfaced to me? Any silent failures?

## Deliverable (this pass)
A written report, not code. Structure it as:
- **Flow map** — the actual end-to-end path with file:line references, and any corrections to the "system context" above.
- **Findings** — concrete problems, each with: what it is, where (file:line), why it hurts real use, and severity (high/med/low).
- **Prioritized polish plan** — ranked recommendations, each tagged with impact (how much better search gets) and effort (how invasive the change). Lead with high-impact / low-effort wins.
- **Open questions / decisions for me** — anything where the right call depends on my preference (e.g. recall vs precision tradeoffs, whether to add a score floor).

## doNotChange / scope
- No code edits this pass — report only.
- Out of scope: the import/matching pipeline's name-similarity scorer, the local `foods.json` search, the recipe-ingredient search. Focus only on the USDA retrieval + ranking + presentation path.
- Don't propose migrating off USDA or swapping data providers unless you find a genuine blocker — assume USDA stays, we're polishing it.

Start with the flow map so we're both looking at the same reality, then give me findings + the ranked plan.
