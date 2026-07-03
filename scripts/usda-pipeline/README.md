# USDA Branded Foods Pipeline

Turns USDA's giant branded-foods download (millions of messy, duplicated rows)
into one clean entry per real product, ready to load into the app's food
database (Cloudflare D1). You run everything on your own computer — no AI
usage, no internet needed after the download.

**You need:** Node.js 20+ (you have it), ~10 GB free disk, ~8 GB free RAM.
The big processing step takes roughly 10–30 minutes.

---

## Step 1 — Download the USDA data (one-time, ~1 hour on normal internet)

1. Go to https://fdc.nal.usda.gov/download-datasets
2. Under **Latest Downloads**, find the **Branded** row and download the
   **CSV** zip (it's a few GB).
3. Unzip it, and move these three files into the `data/` folder here:
   - `food.csv`
   - `branded_food.csv`
   - `food_nutrient.csv` (this one is huge — that's normal)

If the zip unpacks into a dated subfolder, just move the three files up into
`data/` directly.

## Step 2 — Process (dedup happens here)

```bash
cd scripts/usda-pipeline
node --max-old-space-size=6144 src/run.mjs --data ./data --out ./out
```

Progress prints as it goes. When it finishes, it writes into `out/`:

| File | What it is |
|---|---|
| `summary.txt` | The report: rows in, foods out, flagged count, size estimate |
| `preview.csv` | Top 2,000 foods — open in a spreadsheet for a sanity skim |
| `canonical-foods.ndjson` | The full clean food list (one food per line) |
| `flagged-groups.ndjson` | Groups where the duplicate rows disagreed >10% — worth a look |
| `brands.ndjson` | Brand list used for search ranking |

**Nothing has touched the online database yet.** Take your time reviewing.

Useful options (add to the command): `--max-rows 100000` (keep only the best
100k foods), `--category "Soda,Cheese"`, `--no-ingredients` (smaller database),
`--keep-discontinued`, `--all-countries`.

## Step 3 — Build the SQL files

```bash
node src/build-sql.mjs --in ./out/canonical-foods.ndjson --sql ./out/sql
```

## Step 4 — Load into the database

Make sure the Cloudflare account is on **Workers Paid** ($5/mo) first:
https://dash.cloudflare.com → Workers & Pages → Plans. (The free plan only
allows 100k database writes per day — a full load needs millions.)

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

Done — searches now hit the clean database first, and fall back to live USDA
for anything not in it.

---

## Re-running later (USDA updates their data twice a year)

Just repeat steps 1–5 with a fresh download. Reloading is safe: existing foods
are replaced, not duplicated.

## Tests

```bash
node --test
```
