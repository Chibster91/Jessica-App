# Local Food Database Fact-Check Audit

**Date:** July 2, 2026
**Scope:** All 618 foods in `jessica-app/public/foods.json` (per-100g values, all claiming USDA/FDC as source)
**Method:**
1. Internal consistency checks on every entry (calories vs. 4/4/9 Atwater math, fiber ≤ carbs, macros ≤ 100g, negative/implausible values)
2. Manual comparison of all 618 entries against USDA SR Legacy / Foundation / FNDDS reference values
3. Live verification of every flagged entry against the USDA FoodData Central API

## Bottom line

**About 590 of 618 entries check out.** The produce, plain meats, fish, dairy, beans, grains, oils, sugars, nuts, flours, and spices are overwhelmingly exact matches to USDA data. **14 entries have confirmed wrong values**, and a handful more have cosmetic labeling issues. One error is large (sorghum, ~2.7× too high); several others matter for calorie tracking (ground turkey, ground chicken, latte, oyster sauce).

## Confirmed errors (verified against USDA FDC API)

| # | Food | In database | USDA says | Problem |
|---|------|-------------|-----------|---------|
| 353 | Sorghum, cooked | 329 kcal, P10.6 C72.1 F3.5 | Dry grain = 329 kcal; **cooked ≈ 123 kcal**, P4.0 C27 F1.3 fib2.5 | Row holds **dry, uncooked** grain values but is labeled "Cooked" — logs ~2.7× too many calories |
| 186 | Ground turkey, 93/7, cooked | 148 kcal, F4.3 | **207–213 kcal, F11.4–11.6** | Values are close to USDA *fat-free* ground turkey (138 kcal, F2.5); understates calories ~30% and fat ~60% |
| 183 | Ground chicken, cooked | 161 kcal, F6.2 | **189–201 kcal, F10.3–10.9** | Understates calories ~15–20% and fat ~40% |
| 452 | Whiskey, 80 proof | 250 kcal | **231 kcal** | 250 is USDA's **86-proof** value |
| 455 | Gin, 80 proof | 263 kcal | **231 kcal** | 263 is USDA's **90-proof** value |
| 301 | Oyster sauce | 92 kcal, P3.3 C20.7, Na2733 | **51 kcal, P1.4 C10.9, Na2730** | Sodium matches USDA exactly but calories/carbs/protein are ~2× USDA — macros look doubled or pulled from a different source |
| 569 | Beef jerky | 369 kcal, C24 F14.4, Na1785 | **410 kcal, C11 F25.6, Na1780** | Same mixed-source pattern: sodium is USDA's, macros aren't (carbs 2× high, fat ~half) |
| 133 | Whipping cream | 257 kcal, F26.7 | Light whipping = **292 kcal, F30.9**; heavy = 340, F36.1 | Matches no USDA cream; understates by ~12% |
| 208 | Bacon, Canadian, cooked | 185 kcal, F9.3 | **146 kcal, F2.8**, Na993 | Fat is ~3× USDA; Canadian bacon is a lean product |
| 207 | Bacon, turkey, cooked | 218 kcal, F10.5, Na1650 | **368 kcal, F25.9, Na2020** | Far from USDA. (It *is* close to modern brand labels like Butterball, which are leaner than USDA's legacy entry — but the source column says USDA/FDC) |
| 107 | Coconut milk, canned, full fat | 230 kcal, F23.8, Na15 | Canned = **197 kcal, F21.3, Na13** | Row holds USDA's **raw** (fresh-pressed) coconut milk values, not canned |
| 417 | Latte, whole milk | 61 kcal | **43 kcal** (USDA FNDDS "Coffee, Latte") | Value is just plain whole milk with no espresso dilution; ~40% high |
| 419 | Cappuccino, whole milk | 40 kcal | **27 kcal** (USDA FNDDS "Coffee, Cappuccino") | ~48% high |
| 593 | Old Bay seasoning | Na 7,040 mg | **Na ~23,300 mg** (manufacturer data in FDC Branded) | Sodium understated more than 3× — Old Bay is mostly celery salt |

Near-miss worth noting: **#376 Almond butter** — macros (P21.0 C18.8 F55.5 fib10.3) match USDA exactly but calories say 634 where USDA says **614** (~3% high).

## Minor labeling issues (values fine, labels/duplicates off)

- **#19 vs #20** (russet potato with/without skin) and **#23 vs #24** (sweet potato with/without skin): each pair has identical calories/macros — the "with skin" and "without skin" variants were not actually differentiated (USDA does differ slightly).
- **#379 "Eggs, whole, large" vs #496 "Eggs, hard-boiled"**: duplicate foods with slightly different protein (13.0 vs 12.6). USDA hard-boiled = 12.6.
- **#605 Tomato paste**: Na 59 is USDA's *no-salt-added* paste; regular salted canned paste is ~590. Fine if Jessica buys no-salt-added.
- **#1 Broccoli, cooked**: protein/fiber (2.9/2.6) are the raw-broccoli numbers; USDA cooked = 2.4/3.3. Calories are right; trivial.
- **#446–456 alcohol entries**: calories intentionally exceed the 4/4/9 macro math because alcohol carries 7 kcal/g — this is correct, not an error (values verified: beer 43 ✓, wine 82–85 ✓, 80-proof spirits 231 ✓ except whiskey/gin above).

## Entries flagged during the audit and cleared

Cocoa powder (228), baking powder (53), allspice (263), vanilla extract (288): all fail naive Atwater math but match USDA exactly — USDA uses food-specific calorie factors for these. Reduced-fat sour cream (138) matches USDA "Cream, sour, reduced fat, cultured" (135). Coconut oil (892) matches USDA SR Legacy exactly. Salt (Na 38,758) and baking soda (Na 27,360) are chemically exact.

## Suggested corrected values (per 100g)

| # | Food | kcal | P | C | F | fib | Na |
|---|------|------|---|---|---|-----|----|
| 353 | Sorghum, cooked | 123 | 4.0 | 27.0 | 1.3 | 2.5 | 1 |
| 186 | Ground turkey, 93/7, cooked | 213 | 27.1 | 0 | 11.6 | 0 | 90 |
| 183 | Ground chicken, cooked | 189 | 23.3 | 0 | 10.9 | 0 | 75 |
| 452 | Whiskey, 80 proof | 231 | 0 | 0 | 0 | 0 | 1 |
| 455 | Gin, 80 proof | 231 | 0 | 0 | 0 | 0 | 1 |
| 301 | Oyster sauce | 51 | 1.4 | 10.9 | 0.3 | 0.3 | 2733 |
| 569 | Beef jerky | 410 | 33.2 | 11.0 | 25.6 | 1.8 | 1785 |
| 133 | Whipping cream (light) | 292 | 2.2 | 3.0 | 30.9 | 0 | 34 |
| 208 | Bacon, Canadian, cooked | 146 | 28.3 | 1.8 | 2.8 | 0 | 993 |
| 207 | Bacon, turkey, cooked | 368 | 29.5 | 4.2 | 25.9 | 0 | 2020 |
| 107 | Coconut milk, canned, full fat | 197 | 2.0 | 2.8 | 21.3 | 2.2 | 13 |
| 417 | Latte, whole milk | 43 | 2.8 | 4.4 | 1.6 | 0 | 35 |
| 419 | Cappuccino, whole milk | 27 | 1.7 | 2.8 | 1.0 | 0 | 23 |
| 593 | Old Bay seasoning | 312 | 10.5 | 57.5 | 4.5 | 9.5 | 23300 |
| 376 | Almond butter | 614 | 21.0 | 18.8 | 55.5 | 10.3 | 4 |

Note on sorghum: USDA has no "cooked sorghum" entry; the suggested values are the dry-grain values diluted by the standard ~2.7× water absorption, consistent with how cooked barley/rice compare to dry. Note on turkey bacon: if the goal is matching what's on today's grocery-store packages (Butterball ≈ 30 kcal per cooked slice), the current 218 kcal value is defensible — but then the source should not say USDA/FDC.
