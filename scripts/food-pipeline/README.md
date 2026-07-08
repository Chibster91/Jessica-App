# Food Database Pipeline

Turns the [OpenNutrition dataset](https://www.opennutrition.app) (a clean,
pre-deduped TSV of ~327k foods — grocery/branded, everyday/generic,
restaurant, and prepared) into the app's food database (Cloudflare D1). You
run everything on your own computer — no AI usage, no internet needed after
the download.

This replaced an earlier pipeline built from USDA's branded-food bulk CSVs.
That data required a whole dedup-voting stage to collapse millions of
duplicate/near-duplicate rows into one product; OpenNutrition already ships
one row per product, so ingestion here is a straight field mapping.

**You need:** Node.js 20+ (you have it), ~2 GB free disk, ~4 GB free RAM.
The processing step takes a few minutes.

**License note:** OpenNutrition data is ODbL-licensed (portions sourced from
Open Food Facts). The app must show attribution to OpenNutrition and Open
Food Facts wherever this data is displayed — already wired into the app's
search results and Profile privacy sheet; don't remove that copy.

---

## Step 1 — Get the OpenNutrition data (one-time)

1. Download `opennutrition_foods.tsv` from https://www.opennutrition.app.
2. Move it into the `data/` folder here, so you have
   `scripts/food-pipeline/data/opennutrition_foods.tsv`.

## Step 2 — Process

```bash
cd scripts/food-pipeline
node --max-old-space-size=6144 src/run.mjs --data ./data --out ./out
```

Progress prints as it goes. When it finishes, it writes into `out/`:

| File | What it is |
|---|---|
| `summary.txt` | The report: rows in, foods out, dropped counts, size estimate |
| `preview.csv` | Top 2,000 foods — open in a spreadsheet for a sanity skim |
| `canonical-foods.ndjson` | The full clean food list (one food per line) |
| `brands.ndjson` | Brand list used for search ranking |

**Nothing has touched the online database yet.** Take your time reviewing.

Useful options (add to the command): `--max-rows 100000` (keep only the best
100k foods by rank), `--types "grocery,everyday"` (only ingest some of the
four OpenNutrition types — default is all four), `--no-ingredients` (smaller
database).

## Step 3 — Build the SQL files

```bash
node src/build-sql.mjs --in ./out/canonical-foods.ndjson --sql ./out/sql
```

## Step 4 — Load into the database

Make sure the Cloudflare account is on **Workers Paid** ($5/mo) first:
https://dash.cloudflare.com → Workers & Pages → Plans. (The free plan only
allows 100k database writes per day — a full load needs millions.)

If you're replacing the entire dataset (e.g. the original USDA-derived
cutover), back up and wipe the existing tables first — see the "Full
reload" note below. Otherwise:

```bash
node src/load.mjs --sql ./out/sql --db jessica-foods --remote
```

This runs chunk by chunk and remembers where it left off — if it fails or you
stop it, just run the exact same command again and it resumes.

## Step 5 — Deploy the worker

```bash
cd ../../jessica-worker
npm run deploy
```

Done — searches now hit the clean database.

---

## Full reload (replacing all data, not just updating it)

Back up first:

```bash
npx wrangler d1 export jessica-foods --remote --output ../../jessica-foods-backup-$(date +%Y%m%d).sql
```

Then wipe before loading fresh data:

```bash
npx wrangler d1 execute jessica-foods --remote --command "DELETE FROM foods; DELETE FROM food_tokens; DELETE FROM brands;"
```

## Re-running later (OpenNutrition publishes updates periodically)

Just repeat steps 1–5 with a fresh download. Reloading is safe: existing foods
are replaced, not duplicated — each product gets a stable id derived from its
OpenNutrition source id, so the same product keeps the same id across runs.

## Tests

```bash
node --test test/*.mjs
```
