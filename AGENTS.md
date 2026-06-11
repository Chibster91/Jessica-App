# AGENTS.md

Guidance for coding agents working in `/home/chibster/jessica-project`.

## Repository Overview

This repository contains two independently installed and deployed TypeScript packages:

- `jessica-app/`: React 19, Vite 8, TypeScript, and `vite-plugin-pwa`.
- `jessica-worker/`: Cloudflare Worker that proxies USDA FoodData Central.

There is no root `package.json`. Run package commands from the package they belong to.

The product is a local-first nutrition and health tracker branded as **FoodVault** in the HTML/PWA metadata and referred to as **Jessica** in parts of the UI, storage, and debug output.

## Worktree Safety

- The repository may contain active user changes and untracked investigation or asset files.
- Inspect `git status --short` before editing.
- Do not restore, delete, move, or reformat unrelated files.
- In particular, food icon assets may be undergoing migration between `public/Icons/` and `src/assets/icons/`; follow the current code and worktree rather than old paths.
- Do not treat `appSupport.ts.backup`, root investigation documents, root data dumps, or the unused worker Task files as runtime sources of truth.

## Commands

Install dependencies separately:

```bash
cd jessica-app && npm ci
cd ../jessica-worker && npm ci
```

Frontend commands:

```bash
cd jessica-app
npm run dev       # Vite dev server, normally http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run preview   # Preview the production bundle
```

Worker commands:

```bash
cd jessica-worker
npm run dev         # Wrangler local development, normally http://localhost:8787
npm run deploy      # Deploy the worker
npm run cf-typegen  # Regenerate worker-configuration.d.ts after binding changes
```

There is no automated test suite and the worker package has no standalone type-check script. For worker changes, `npm run dev` is the most direct local compile/runtime check.

Current verification baseline as of June 10, 2026:

- `jessica-app`: `npm run build` passes.
- `jessica-app`: `npm run lint` has 14 existing `@typescript-eslint/no-explicit-any` errors in `src/components/AppViewRouter.tsx` and `src/components/LogView.tsx`.
- The production bundle currently emits a Vite warning because the main JavaScript chunk is over 500 kB.

Do not claim a clean lint run unless those existing errors have actually been resolved.

## Frontend Architecture

### Entry and Routing

- `src/main.tsx` imports the global CSS and Nunito font weights, then renders `App`.
- `src/App.tsx` is the application controller. It owns nearly all cross-view state, persistence effects, modal state, event handlers, import matching, OAuth flow, and derived view props.
- `src/components/AppViewRouter.tsx` selects one of six `AppView` values:
  - `home`
  - `day`
  - `weight`
  - `egg-oracle`
  - `library`
  - `profile`
- `src/components/AppChrome.tsx` renders the persistent bottom navigation plus the debug and completed-streak overlays.

The app does not use React Router. Navigation is in-memory `AppView` state, so do not add URL-routing assumptions to view code.

### Shared Domain Module

`src/appSupport.ts` is the shared frontend domain and integration module. It contains:

- Core TypeScript types for foods, logs, recipes, profiles, goals, weight entries, USDA details, imports, and Google Drive.
- localStorage parsing and persistence helpers.
- Profile migration, validation, BMR/TDEE, calorie-target, and macro calculations.
- Serving-size parsing, unit conversion, portion selection, and nutrition scaling.
- Local and USDA food search, synonyms, ranking, display-name cleanup, and grouped results.
- Recipe and custom-food parsing and nutrition totals.
- Food-log JSON import parsing.
- Nutrition-label OCR parsing helpers.
- Date, weight, height, and display formatting.
- Food icon selection.

Put reusable domain logic here when it is shared by multiple views or affects persisted/application-wide behavior. Keep view-only calculations and rendering behavior in the relevant component. Do not make this already large module a dumping ground for unrelated UI state.

### View Responsibilities

- `HomeView.tsx`: weekly calorie and macro dashboard, daily/weekly goals, streak, current weight, and today's summary.
- `LogView.tsx`: daily log, meal cards, food adding, serving selection, custom foods, recipes, OCR UI, JSON import review, day import/export, Drive dialogs, and move/edit/delete flows.
- `FoodLibraryView.tsx`: recent foods, custom-food CRUD, recipe CRUD, and ingredient selection.
- `ProfileView.tsx`: profile summary, setup/edit wizard, calorie and macro targets, theme, cycle visibility, data export/import, Drive entry point, and destructive data reset.
- `WeightView.tsx`: weigh-in form, history, summary statistics, BMI, progress, range filters, trend/goal chart, edit, and delete.
- `CycleView.tsx`: self-contained cycle calendar and statistics, daily period/mucus/OPK/intercourse/notes logging, estimates, and manual defaults.
- `WeightEntryRow.tsx`: reusable weight-history row.

Most views are controlled by `App.tsx`. `AppViewRouter` and `LogView` currently use broad `any` prop surfaces. Prefer improving concrete prop types when changing those boundaries, but avoid a large prop-typing refactor during unrelated work.

### Styling

- `src/styles/index.css`: root variables, theme tokens, resets, typography, and base controls.
- `src/styles/globals.css`: shared application, modal, overlay, navigation, and cross-view styles.
- `home.css`, `log.css`, `library.css`, `profile.css`, `weight.css`, and `eggOracle.css`: view-specific styles.

Preserve the existing CSS-variable theme model and mobile-first behavior. Check both `data-theme="dark"` and `data-theme="light"` when changing colors. Keep fixed bottom navigation, modal safe areas, narrow screens, and touch interaction in mind.

## Data and Persistence

The frontend has no user account or application database. User data is stored in browser `localStorage`.

Important keys:

- `log-YYYY-MM-DD`: food log for one date.
- `customFoods`
- `recipes`
- `weightEntries`
- `completedDays`
- `topFoods`
- `profile`
- `profile_backup`
- `goals`: retained for compatibility and derived from the profile.
- `theme-mode`
- `eggOracleTrackingFirst.v2`: cycle tracking data.
- `googleDriveClientId`
- `oauthPendingAction`
- `jessicaDebugLog`

Persistence expectations:

- Treat stored shapes as public compatibility contracts.
- Add normalization, defaults, or migration behavior when fields change.
- Existing saved logs may lack `category` or `quantity`; current fallbacks are `Snacks` and `1`.
- Preserve stable IDs when editing custom foods, recipes, weight entries, or imported records.
- Use the existing guarded storage helpers where possible; localStorage can throw in private or constrained browser modes.
- `clearAllData()` intentionally clears all localStorage, while the food debug clear removes only food-related data.
- Cycle data is managed independently inside `CycleView.tsx`; general app export currently does not include the cycle key, completed days, top foods, goals, theme, or debug data.

## Nutrition and Food Data

### Local Foods

- `public/foods.json` is the curated built-in whole-food dataset.
- Values are generally per 100 g and records may define `measurementType` as `solid`, `liquid`, or `spoonable`.
- It is fetched with `import.meta.env.BASE_URL`, which is required for GitHub Pages subpath deployment.
- `public/foods_measurementType.json` is supporting data; runtime behavior currently reads `foods.json`.

### Food Search

Food search can combine:

- Built-in local foods.
- User custom foods.
- User recipes.
- Recently logged foods.
- Packaged/branded USDA results from the worker.

Search and import matching are deliberately heuristic. They include synonyms, brand aliases, token normalization, singularization, serving-unit compatibility, nutrition tolerances, confidence levels, manual overrides, and remembered matches. Changes can silently select nutritionally different foods, so preserve review paths and test ambiguous names, brands, preparation forms, and serving units.

`searchUsdaFoodsWithSynonyms()` currently returns local results without calling USDA when at least one local match exists. `searchFoodsGrouped()` explicitly builds `My Foods`, `Whole Foods`, and `Packaged` groups and does call USDA.

### Portions and Nutrition

Do not assume every food is represented on the same basis:

- Local foods generally contain usable per-100-unit nutrition immediately.
- USDA search results are previews with zero nutrition until `/detail` is loaded.
- Branded foods may use label nutrients per serving.
- Foundation/SR foods may expose nutrients per 100 g plus household portions.
- Portion labels, gram weights, serving counts, and explicit `g`, `oz`, `ml`, `cup`, `tbsp`, or `tsp` amounts all participate in scaling.

When changing serving logic, verify at least:

- A local solid food in grams and ounces.
- A local liquid or spoonable food in its allowed units.
- A branded USDA food with label nutrients.
- A USDA whole food with household portions.
- Multiple servings of a selected household portion.
- Edit and re-save of an existing logged item.
- Recipe ingredient and imported-food calculations.

Avoid rounding until the established display or storage boundary. A serving change can affect calories, macros, recipes, imports, and historical edit behavior.

### Food Icons

- Runtime icons live in `src/assets/icons/*.svg`.
- `src/assets/icons/food_icon_mapping.json` is an ordered list of `[keyword, filename]`.
- `appSupport.ts` loads icons with `import.meta.glob`.
- Matching is case-insensitive substring matching against the food name only.
- More specific keywords must appear before generic keywords.
- The fallback is `fork_and_knife_with_plate.svg`.

When adding or renaming an icon, update the mapping, confirm the file exists, preserve its license/provenance, and run a production build so Vite resolves it.

## Import, Export, OCR, and Drive

### JSON Import and Export

- Day export produces `food-log-YYYY-MM-DD.json`.
- Full export produces `jessica-data-YYYY-MM-DD.json`.
- Imports may contain food logs and weight entries and can run as a per-day stepper or a full review flow.
- Import resolution can match local foods, custom foods, recipes, or USDA foods, or create a new custom food.
- Review rows require explicit Apply or Reject before final confirmation.
- `test-week-import.json` is a useful manual fixture.

Preserve audit metadata and the ability to manually override low-confidence matches. Validate malformed JSON, duplicate foods, unfamiliar meal names, weight-only days, mixed units, and partial nutrition.

### Nutrition Label OCR

Tesseract.js runs in the browser from `App.tsx`. OCR output is normalized and parsed in `appSupport.ts` before populating a custom-food form. Treat OCR as untrusted input: keep the raw-text review path and validation, and do not auto-save scanned values.

### Google Drive

- OAuth uses Google Identity Services when available.
- Installed PWA mode can fall back to an OAuth redirect and resume an action through `oauthPendingAction`.
- Access tokens stay in React state, not durable storage.
- The client ID comes from `VITE_GOOGLE_CLIENT_ID` or the `googleDriveClientId` localStorage fallback.
- Drive upload/list/download calls are made directly from the browser.
- The requested scopes are `drive.file` and `drive.readonly`.

Do not commit client secrets or `.env` files. The OAuth client ID is public configuration, but authorized origins and redirect behavior must include both local development and the GitHub Pages deployment.

## PWA and Deployment

- Vite's base path is `/Jessica-App/`; preserve base-aware URLs.
- PWA metadata and generated service worker configuration are in `vite.config.ts`.
- `index.html` also contains standalone/mobile metadata.
- The current `App.tsx` startup effect unregisters all service workers and deletes all Cache Storage entries. Therefore the build generates PWA assets, but offline caching is effectively cleared at runtime. Do not describe offline behavior as functional without changing and testing this startup logic.
- `.github/workflows/deploy-pages.yml` uses Node 22, `npm ci`, and `npm run build`, then deploys `jessica-app/dist` to GitHub Pages on `main`.
- CI injects `VITE_GOOGLE_CLIENT_ID` from the repository secret.
- The workflow deploys only the frontend. Worker deployment is separate and not represented by a GitHub Actions workflow here.

## Worker Architecture and API Contract

The active worker is `jessica-worker/src/index.ts`, implemented as a plain exported `fetch` handler. Despite installed Hono/Chanfana dependencies and template files under `src/endpoints/`, the Task CRUD classes are not imported and are not part of the runtime.

Active routes:

- `GET /?query=<text>`: expands USDA searches, filters survey/experimental foods, ranks and deduplicates results, and returns up to 15 preview foods.
- `GET /detail?id=<numeric FDC id>`: fetches full USDA detail, normalizes serving units and portions, chooses label or database nutrients as appropriate, and returns frontend-compatible detail data.

Worker details:

- Requires the Cloudflare secret `USDA_API_KEY`.
- Uses the USDA FoodData Central REST API.
- Keeps a module-memory detail cache with a six-hour TTL. It is opportunistic and not durable across isolates/deploys.
- Returns JSON with `Access-Control-Allow-Origin: *`.
- Does not currently implement an explicit `OPTIONS` route.
- `src/fdc-types.ts` models both documented and observed USDA response shapes.
- `wrangler.jsonc` defines the worker name, entry point, compatibility date, observability, source maps, and `nodejs_compat`.

The frontend hard-codes `https://jessica-worker.snack-bunker.workers.dev` in `appSupport.ts`; local frontend development does not automatically use local Wrangler. If changing the endpoint, introduce an environment-based override while retaining a production default.

The nested `jessica-worker/AGENTS.md` also applies to worker files. Follow its requirement to consult current official Cloudflare documentation for Workers APIs, bindings, quotas, and limits.

When changing the worker response:

- Update frontend `Food`/`FoodDetail` assumptions in the same change.
- Preserve search-preview semantics: previews have `isSearchPreview: true`; detail results do not.
- Check non-2xx USDA responses, missing secrets, invalid IDs, nutrient units, branded label values, Foundation foods, and household portions.
- Never expose `USDA_API_KEY` to the frontend.

## Verification by Change Type

Frontend UI or domain change:

```bash
cd jessica-app
npm run build
npm run lint
```

Report the known lint baseline separately from new violations. Manually exercise the affected view at mobile width and check dark and light themes.

Persistence or import change:

- Test with existing/legacy localStorage data as well as an empty profile.
- Export before import, import `test-week-import.json`, review matches, reload, and verify persisted results.
- Confirm destructive actions only remove their intended keys.

Food search, portion, or worker change:

- Run the frontend build.
- Run the worker locally with `USDA_API_KEY` configured.
- Exercise both active endpoints and then select/add the returned foods in the frontend.
- Compare calories and macros against the response basis rather than only checking that the UI renders.

PWA or base-path change:

- Run `npm run build`.
- Inspect `dist/manifest.webmanifest`, generated service-worker files, and asset URLs under `/Jessica-App/`.
- Test installed/standalone mode and browser mode separately.

## Editing Conventions

- Prefer the existing React function-component and hook style.
- Use `import type` where imports are type-only.
- Keep strict TypeScript compatibility; the frontend build rejects unused locals and parameters.
- Use existing formatting and naming in the file being edited; the codebase currently mixes semicolon styles, so avoid unrelated formatting churn.
- Keep accessibility behavior: labels, dialog roles, keyboard actions, and touch targets matter in this mobile-oriented app.
- Use `getLocalDateString()` and existing date helpers for local calendar dates; avoid UTC date slicing for user-facing day keys.
- Do not add a state library, router, database, or new backend framework without a concrete need and a repository-wide migration plan.
- Keep secrets out of source, fixtures, logs, exports, and screenshots.

## Known Technical Risks

- `App.tsx`, `appSupport.ts`, and `LogView.tsx` are very large and tightly coupled.
- Broad `any` props weaken component contracts and currently fail lint.
- There is no automated regression coverage for nutrition math, import matching, persistence migration, or worker response normalization.
- The main frontend bundle is large, with Tesseract and all eagerly imported views in the same application path.
- PWA generation conflicts with runtime service-worker/cache removal.
- Full export is not a complete backup of every localStorage key.
- The worker's template dependencies and unused Task files can mislead maintainers about the active architecture.

Keep fixes scoped, but add focused pure-function tests if introducing a test runner becomes justified by risky nutrition, parsing, or migration work.
