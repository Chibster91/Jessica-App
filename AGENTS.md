# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## Repository Structure

This is a monorepo with two independent packages:

- `jessica-app/` - React 19 + TypeScript + Vite PWA frontend.
- `jessica-worker/` - Cloudflare Worker backend API, deployed separately.

## Commands

Run commands from the relevant package directory.

### Frontend: `jessica-app/`

```bash
npm run dev       # Vite dev server at http://localhost:5173
npm run build     # TypeScript build plus Vite production build
npm run lint      # ESLint
npm run preview   # Preview production bundle locally
```

### Worker: `jessica-worker/`

```bash
npm run dev         # Wrangler dev at http://localhost:8787, includes Swagger UI
npm run deploy      # Deploy to Cloudflare
npm run cf-typegen  # Regenerate Wrangler environment types
```

### CI/CD

GitHub Actions workflow `.github/workflows/deploy-pages.yml` runs the frontend TypeScript and Vite build in `jessica-app/`, then deploys `jessica-app/dist/` to GitHub Pages on pushes to `main`.

There is currently no automated test suite.

## Architecture

### Frontend

- Entry point: `jessica-app/src/main.tsx`, which renders `App.tsx`.
- `jessica-app/src/appSupport.ts` is the core module and source of truth for most shared frontend logic. It contains TypeScript types, localStorage helpers, nutrition calculations, food search relevance and synonym logic, food icon rules, and formatting utilities.
- `App.tsx` switches between the main `AppView` states: `home`, `day`, `library`, `profile`, `weight`, and `egg-oracle`.
- Persistence is localStorage-first. Food logs, profile data, recipes, and weight entries are stored client-side.
- USDA food search calls the live Cloudflare Worker at `https://jessica-worker.snack-bunker.workers.dev/`; there is no local database.
- The GitHub Pages base path is `/Jessica-App/`, configured in `jessica-app/vite.config.ts`.
- PWA behavior is configured through `vite-plugin-pwa` in `jessica-app/vite.config.ts`, including offline caching and auto-updates.
- Google Drive backup uses OAuth2 through `window.google.accounts.oauth2`. The client ID comes from `VITE_GOOGLE_CLIENT_ID` in `jessica-app/.env`.
- Nutrition label scanning runs Tesseract.js OCR directly in the browser.

### Worker

- `jessica-worker/` is a template-style Hono + Chanfana OpenAPI app.
- Current repository endpoints are placeholder Task CRUD routes.
- The production worker at `snack-bunker.workers.dev` proxies USDA FoodData Central API calls.
- Worker environment configuration lives in `jessica-worker/wrangler.jsonc`.

## Working Conventions

- Prefer existing patterns over new abstractions.
- Keep frontend business logic centralized in `appSupport.ts` when adding or changing shared types, nutrition math, persistence helpers, food search behavior, or formatting utilities.
- Extend the food keyword-to-icon map in `appSupport.ts` when adding icons for new food categories.
- Treat localStorage data shape changes carefully; add migration or fallback handling when old saved user data may exist.
- Remember that `.env` is gitignored. Google Drive integration requires a local `VITE_GOOGLE_CLIENT_ID`.
- Since there are no automated tests, use `npm run build` and `npm run lint` in `jessica-app/` for frontend verification when relevant. Use worker commands in `jessica-worker/` only for worker changes.
