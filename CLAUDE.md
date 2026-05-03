# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Structure

Monorepo with two independent packages:
- `jessica-app/` — React 19 + TypeScript + Vite PWA (frontend)
- `jessica-worker/` — Cloudflare Worker (backend API, deployed separately)

## Commands

### Frontend (`jessica-app/`)
```bash
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # tsc -b && vite build
npm run lint      # ESLint
npm run preview   # Preview production bundle locally
```

### Worker (`jessica-worker/`)
```bash
npm run dev       # wrangler dev at http://localhost:8787 (includes Swagger UI)
npm run deploy    # wrangler deploy to Cloudflare
npm run cf-typegen  # regenerate wrangler env types
```

### CI/CD
GitHub Actions (`.github/workflows/deploy-pages.yml`) runs `tsc -b && vite build` in `jessica-app/` and deploys `jessica-app/dist/` to GitHub Pages on push to `main`. There are no automated tests.

## Architecture

### Frontend
**Entry**: `jessica-app/src/main.tsx` → `App.tsx`

**`appSupport.ts`** is the core module (~2000+ lines). It contains all TypeScript types, localStorage read/write helpers, nutritional math (TDEE, macro splitting, BMI, calorie goals), food search with synonym/relevance scoring, and formatting utilities. Almost every component imports from here.

**Views** (rendered by `App.tsx` based on `AppView` state): `home`, `day`, `library`, `profile`, `weight`, `egg-oracle`.

**Data flow**: All user data (food logs, profile, recipes, weight entries) lives in `localStorage`. The app calls the live Cloudflare Worker at `https://jessica-worker.snack-bunker.workers.dev/` for USDA FDC food search — there is no local DB.

**Base path**: `/Jessica-App/` (GitHub Pages subdirectory). Set in `vite.config.ts` as `base: '/Jessica-App/'`.

**PWA**: Configured in `vite.config.ts` via `vite-plugin-pwa`. Service worker handles offline caching and auto-updates.

**Google Drive backup**: OAuth2 via `window.google.accounts.oauth2`. Client ID from `VITE_GOOGLE_CLIENT_ID` env var (set in `jessica-app/.env`).

**Nutrition label scanner**: Uses Tesseract.js for OCR directly in the browser.

### Worker
Template-style Hono + Chanfana (OpenAPI) app. Current endpoints are Task CRUD (placeholder structure). The actual production worker at `snack-bunker.workers.dev` proxies USDA FoodData Central API calls.

Worker environment config is in `jessica-worker/wrangler.jsonc`.

## Key Patterns

- **No test suite** — there are no unit or integration tests in this repo.
- **localStorage-first** — all persistence is client-side; no auth or user accounts.
- **`appSupport.ts` is the source of truth** for types and business logic. When adding features, extend this file rather than scattering logic in components.
- **Food icons** are derived at runtime from food name keywords in `appSupport.ts` (rules like "apple" → 🍎). To add icons for new food categories, extend the keyword map there.
- **`.env` is gitignored** — `VITE_GOOGLE_CLIENT_ID` must be set locally for Google Drive integration to work.
