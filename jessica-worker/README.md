# jessica-worker

Cloudflare Worker that proxies the [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide.html) for the Jessica App frontend. Deployed at `https://jessica-worker.snack-bunker.workers.dev/`.

## Endpoints

- `GET /?query=<text>` — food search. Fans the query out to multiple USDA searches (plain, branded-only, and brand-aware variants), filters experimental/survey foods, ranks by relevance, and returns up to 15 lightweight preview results.
- `GET /detail?id=<fdcId>` — full food detail with normalized serving sizes, portions, and nutrient values. Responses are cached in-memory for 6 hours per worker isolate.

Responses are CORS-restricted to the GitHub Pages origin and localhost dev/preview origins (see `ALLOWED_ORIGINS` in `src/index.ts`).

## Configuration

The USDA API key is a worker secret:

```bash
npx wrangler secret put USDA_API_KEY   # production
echo 'USDA_API_KEY=...' > .dev.vars    # local dev (gitignored)
```

## Commands

```bash
npm run dev       # wrangler dev at http://localhost:8787
npm run deploy    # wrangler deploy to Cloudflare
npm run cf-typegen  # regenerate worker-configuration.d.ts after wrangler.jsonc changes
```
