#!/usr/bin/env node
// USDA Branded Foods dedup pipeline. Streams the bulk CSVs, collapses
// duplicate rows into one canonical food per product, and writes reviewable
// output files. Nothing here touches D1 — loading is a separate step.
//
// Usage:
//   node --max-old-space-size=6144 src/run.mjs --data ./data --out ./out
//
// Flags:
//   --keep-discontinued          keep rows with a discontinued_date (default: drop)
//   --allow-incomplete-macros    keep rows missing energy/protein/carbs/fat (default: require)
//   --no-ingredients             don't carry ingredient text (smaller D1)
//   --all-countries              keep non-US market rows (default: US only)
//   --max-rows N                 keep only the top-N canonical foods by rank
//   --category "Soda,Cheese"     keep only matching branded_food_category values
//   --brands-file path           newline-separated brand allowlist

import { createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCsvFile, headerIndex, requireColumns } from "./csv.mjs";
import { normalizeName, displayName } from "./normalizeName.mjs";
import { validBasis, groupKeyOf, nutritionKey } from "./fingerprint.mjs";
import { modalNutrition } from "./modal.mjs";
import { buildPortions } from "./portions.mjs";
import { extractTokens, normalizeForMatching } from "./tokens.mjs";

const NUTRIENTS = [
  { id: 1008, field: "kcal" },
  { id: 2047, field: "kcalAtwaterGeneral" },
  { id: 2048, field: "kcalAtwaterSpecific" },
  { id: 1003, field: "protein" },
  { id: 1004, field: "fat" },
  { id: 1005, field: "carbs" },
  { id: 1079, field: "fiber" },
  { id: 1093, field: "sodium" },
  { id: 2000, field: "sugars" },
];
const NUTRIENT_ID_TO_COL = new Map(NUTRIENTS.map((n, col) => [n.id, col]));

const startTime = Date.now();
function log(message) {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0).padStart(5);
  const heapMb = Math.round(process.memoryUsage().heapUsed / 1048576);
  console.log(`[${elapsed}s ${String(heapMb).padStart(5)}MB] ${message}`);
}

function fail(message) {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
}

const { values: args } = parseArgs({
  options: {
    data: { type: "string" },
    out: { type: "string" },
    "keep-discontinued": { type: "boolean", default: false },
    "allow-incomplete-macros": { type: "boolean", default: false },
    "no-ingredients": { type: "boolean", default: false },
    "all-countries": { type: "boolean", default: false },
    "max-rows": { type: "string" },
    category: { type: "string" },
    "brands-file": { type: "string" },
  },
});

if (!args.data || !args.out) fail("Required: --data <dir with USDA CSVs> --out <output dir>");

const dataDir = args.data;
const outDir = args.out;
for (const file of ["food.csv", "branded_food.csv", "food_nutrient.csv"]) {
  if (!existsSync(join(dataDir, file))) {
    fail(
      `${join(dataDir, file)} not found.\n` +
        `Download the "Branded" CSV zip from https://fdc.nal.usda.gov/download-datasets ` +
        `and unzip it so food.csv, branded_food.csv and food_nutrient.csv sit directly in ${dataDir}/`
    );
  }
}
mkdirSync(outDir, { recursive: true });

const maxRows = args["max-rows"] ? Number(args["max-rows"]) : null;
const categoryFilters = args.category
  ? args.category.split(",").map((c) => c.trim().toLowerCase()).filter(Boolean)
  : null;
const brandAllowlist = args["brands-file"]
  ? new Set(
      readFileSync(args["brands-file"], "utf8")
        .split("\n")
        .map((line) => normalizeForMatching(line))
        .filter(Boolean)
    )
  : null;

const counts = {
  foodRows: 0,
  brandedRows: 0,
  droppedDiscontinued: 0,
  droppedCountry: 0,
  droppedCategory: 0,
  droppedBrandFilter: 0,
  droppedBadBasis: 0,
  droppedIncompleteMacros: 0,
  droppedMissingName: 0,
  nutrientRows: 0,
  assembled: 0,
  groups: 0,
  flaggedGroups: 0,
  tokenRows: 0,
  brandRows: 0,
};

// ── Pass A: food.csv — branded fdc_ids, names, publication dates ────────────
log("Pass A: food.csv (names + publication dates)…");
const records = new Map(); // fdc_id -> record
{
  let header = null;
  let cols = null;
  for await (const row of parseCsvFile(join(dataDir, "food.csv"))) {
    if (!header) {
      header = row;
      cols = headerIndex(row);
      requireColumns(cols, ["fdc_id", "data_type", "description", "publication_date"], "food.csv");
      continue;
    }
    counts.foodRows++;
    if (counts.foodRows % 500000 === 0) log(`  …${counts.foodRows.toLocaleString()} rows`);
    if (row[cols.get("data_type")] !== "branded_food") continue;
    const fdcId = Number(row[cols.get("fdc_id")]);
    if (!Number.isFinite(fdcId)) continue;
    records.set(fdcId, {
      fdcId,
      name: row[cols.get("description")],
      publicationDate: row[cols.get("publication_date")] ?? "",
    });
  }
}
log(`Pass A done: ${records.size.toLocaleString()} branded foods of ${counts.foodRows.toLocaleString()} total rows`);

// ── Pass B: branded_food.csv — brand/serving/category + row filters ─────────
log("Pass B: branded_food.csv (brands, servings, filters)…");
{
  let header = null;
  let cols = null;
  let seen = 0;
  const col = (row, name) => (cols.has(name) ? row[cols.get(name)] : "");
  for await (const row of parseCsvFile(join(dataDir, "branded_food.csv"))) {
    if (!header) {
      header = row;
      cols = headerIndex(row);
      requireColumns(
        cols,
        ["fdc_id", "brand_owner", "serving_size", "serving_size_unit", "household_serving_fulltext", "branded_food_category"],
        "branded_food.csv"
      );
      continue;
    }
    seen++;
    if (seen % 500000 === 0) log(`  …${seen.toLocaleString()} rows`);
    const fdcId = Number(row[cols.get("fdc_id")]);
    const record = records.get(fdcId);
    if (!record) continue;
    counts.brandedRows++;

    if (!args["keep-discontinued"] && String(col(row, "discontinued_date")).trim()) {
      counts.droppedDiscontinued++;
      records.delete(fdcId);
      continue;
    }
    if (!args["all-countries"]) {
      const country = String(col(row, "market_country")).trim();
      if (country && country !== "United States") {
        counts.droppedCountry++;
        records.delete(fdcId);
        continue;
      }
    }
    const category = String(col(row, "branded_food_category")).trim();
    if (categoryFilters && !categoryFilters.some((f) => category.toLowerCase().includes(f))) {
      counts.droppedCategory++;
      records.delete(fdcId);
      continue;
    }
    const brandOwner = String(col(row, "brand_owner")).trim();
    const brandName = String(col(row, "brand_name")).trim();
    if (
      brandAllowlist &&
      !brandAllowlist.has(normalizeForMatching(brandOwner)) &&
      !brandAllowlist.has(normalizeForMatching(brandName))
    ) {
      counts.droppedBrandFilter++;
      records.delete(fdcId);
      continue;
    }
    const basis = validBasis(col(row, "serving_size_unit"));
    if (!basis) {
      counts.droppedBadBasis++;
      records.delete(fdcId);
      continue;
    }

    record.brandOwner = brandOwner;
    record.brandName = brandName;
    record.category = category;
    record.ingredients = args["no-ingredients"] ? "" : String(col(row, "ingredients")).slice(0, 256);
    record.servingSize = Number(col(row, "serving_size")) || null;
    record.basis = basis;
    record.householdServing = String(col(row, "household_serving_fulltext")).trim();
  }
  // Rows in food.csv with no branded_food.csv row can't be used.
  for (const [fdcId, record] of records) {
    if (!record.basis) records.delete(fdcId);
  }
}
log(`Pass B done: ${records.size.toLocaleString()} rows survive filters`);

// ── Pass C: food_nutrient.csv — 9 nutrient columns, streamed ────────────────
log("Pass C: food_nutrient.csv (this is the big file — several GB)…");
const indexOf = new Map(); // fdc_id -> column index
{
  let i = 0;
  for (const fdcId of records.keys()) indexOf.set(fdcId, i++);
}
const nutrientCols = NUTRIENTS.map(() => new Float32Array(indexOf.size).fill(NaN));
{
  let header = null;
  let cols = null;
  for await (const row of parseCsvFile(join(dataDir, "food_nutrient.csv"))) {
    if (!header) {
      header = row;
      cols = headerIndex(row);
      requireColumns(cols, ["fdc_id", "nutrient_id", "amount"], "food_nutrient.csv");
      continue;
    }
    counts.nutrientRows++;
    if (counts.nutrientRows % 2000000 === 0) log(`  …${counts.nutrientRows.toLocaleString()} rows`);
    const colIdx = NUTRIENT_ID_TO_COL.get(Number(row[cols.get("nutrient_id")]));
    if (colIdx === undefined) continue;
    const rowIdx = indexOf.get(Number(row[cols.get("fdc_id")]));
    if (rowIdx === undefined) continue;
    const amount = Number(row[cols.get("amount")]);
    if (Number.isFinite(amount)) nutrientCols[colIdx][rowIdx] = amount;
  }
}
log(`Pass C done: scanned ${counts.nutrientRows.toLocaleString()} nutrient rows`);

// ── Pass D: assemble, group, modal-vote, emit ────────────────────────────────
log("Pass D: normalize, group, dedup…");
const groups = new Map();
{
  const colFor = (field) => NUTRIENTS.findIndex((n) => n.field === field);
  const cKcal = colFor("kcal"), cAtG = colFor("kcalAtwaterGeneral"), cAtS = colFor("kcalAtwaterSpecific");
  const cP = colFor("protein"), cF = colFor("fat"), cC = colFor("carbs");
  const cFib = colFor("fiber"), cNa = colFor("sodium"), cSug = colFor("sugars");
  const val = (col, idx) => (Number.isNaN(nutrientCols[col][idx]) ? undefined : nutrientCols[col][idx]);

  for (const record of records.values()) {
    const idx = indexOf.get(record.fdcId);
    const calories = val(cKcal, idx) ?? val(cAtG, idx) ?? val(cAtS, idx);
    const protein = val(cP, idx);
    const fat = val(cF, idx);
    const carbs = val(cC, idx);
    if (!args["allow-incomplete-macros"] && (calories === undefined || protein === undefined || fat === undefined || carbs === undefined)) {
      counts.droppedIncompleteMacros++;
      continue;
    }
    const nutrition = {
      calories: calories ?? 0,
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      fiber: val(cFib, idx),
      sodium: val(cNa, idx),
      sugars: val(cSug, idx),
    };
    const quality = [calories, protein, carbs, fat, nutrition.fiber, nutrition.sodium, nutrition.sugars]
      .filter((v) => v !== undefined).length;
    const { normalized, packageSizes, containers } = normalizeName(record.name);
    const groupKey = `${groupKeyOf(normalizeForMatching(record.brandOwner), normalized)}|${record.basis}`;

    const entry = { ...record, nutrition, quality, normalized, packageSizes, containers };
    counts.assembled++;
    const group = groups.get(groupKey);
    if (group) group.push(entry);
    else groups.set(groupKey, [entry]);
  }
}
records.clear();
log(`Pass D grouping done: ${counts.assembled.toLocaleString()} rows → ${groups.size.toLocaleString()} groups`);

// Canonical emission
const canonicalOut = createWriteStream(join(outDir, "canonical-foods.ndjson"));
const flaggedOut = createWriteStream(join(outDir, "flagged-groups.ndjson"));
const brandCounts = new Map(); // normalized brand token -> { display, count }
let canonicals = [];

for (const rows of groups.values()) {
  const { nutrition, deviantCount, flagged } = modalNutrition(rows);
  const modalKey = nutritionKey(nutrition);
  const candidates = rows.filter((row) => nutritionKey(row.nutrition) === modalKey);
  const pool = candidates.length > 0 ? candidates : rows;
  pool.sort(
    (a, b) => b.quality - a.quality || String(b.publicationDate).localeCompare(String(a.publicationDate))
  );
  const rep = pool[0];
  const name = displayName(rep.name);
  if (!name) {
    counts.droppedMissingName++;
    continue;
  }
  const groupSize = rows.length;
  const rank = rep.quality * 2 + Math.min(groupSize, 20);

  const canonical = {
    fdcId: rep.fdcId,
    name,
    originalName: rep.name,
    brandOwner: rep.brandOwner || null,
    brandName: rep.brandName || null,
    category: rep.category || null,
    ingredients: rep.ingredients || null,
    servingSize: rep.servingSize,
    servingSizeUnit: rep.basis,
    householdServing: rep.householdServing || null,
    publicationDate: rep.publicationDate || null,
    per100: nutrition,
    portions: buildPortions(rows, rep.basis, rep),
    quality: rep.quality,
    groupSize,
    rank,
    flagged,
    tokens: extractTokens({
      normalizedName: rep.normalized,
      brandName: rep.brandName,
      brandOwner: rep.brandOwner,
      category: rep.category,
    }),
    sourceFdcIds: rows.slice(0, 50).map((row) => row.fdcId),
  };
  canonicals.push(canonical);
  counts.groups++;

  if (flagged) {
    counts.flaggedGroups++;
    flaggedOut.write(
      JSON.stringify({
        groupKey: `${normalizeForMatching(rep.brandOwner)}|${rep.normalized}`,
        modal: nutrition,
        deviantCount,
        members: rows.map((row) => ({
          fdcId: row.fdcId,
          name: row.name,
          kcal: row.nutrition.calories,
          protein: row.nutrition.protein,
          carbs: row.nutrition.carbs,
          fat: row.nutrition.fat,
          publicationDate: row.publicationDate,
        })),
      }) + "\n"
    );
  }

  const brandToken = normalizeForMatching(rep.brandName);
  if (brandToken.length >= 3) {
    const existing = brandCounts.get(brandToken);
    if (existing) existing.count++;
    else brandCounts.set(brandToken, { display: rep.brandName, count: 1 });
  }
}
groups.clear();

if (maxRows && canonicals.length > maxRows) {
  canonicals.sort((a, b) => b.rank - a.rank);
  canonicals = canonicals.slice(0, maxRows);
  counts.groups = canonicals.length;
}

let foodsBytes = 0;
for (const canonical of canonicals) {
  const line = JSON.stringify(canonical);
  canonicalOut.write(line + "\n");
  counts.tokenRows += canonical.tokens.length;
  foodsBytes += line.length + 60;
}
canonicalOut.end();
flaggedOut.end();

// brands.ndjson — brand-intent lookup for the worker (brands with ≥3 products)
{
  const brandsOut = createWriteStream(join(outDir, "brands.ndjson"));
  for (const [token, { display, count }] of brandCounts) {
    if (count < 3) continue;
    counts.brandRows++;
    brandsOut.write(JSON.stringify({ token, brandName: display }) + "\n");
  }
  brandsOut.end();
}

// preview.csv — top slice for a spreadsheet skim
{
  const preview = [...canonicals].sort((a, b) => b.rank - a.rank).slice(0, 2000);
  const lines = ["fdc_id,name,brand,category,kcal_per_100,protein,carbs,fat,group_size,flagged"];
  for (const c of preview) {
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    lines.push(
      [c.fdcId, esc(c.name), esc(c.brandName || c.brandOwner), esc(c.category),
       c.per100.calories, c.per100.protein, c.per100.carbs, c.per100.fat, c.groupSize, c.flagged].join(",")
    );
  }
  createWriteStream(join(outDir, "preview.csv")).end(lines.join("\n") + "\n");
}

// summary.txt
const tokenBytes = counts.tokenRows * 40;
const estimatedMb = ((foodsBytes + tokenBytes) / 1048576).toFixed(0);
const totalWrites = counts.groups + counts.tokenRows + counts.brandRows;
const summary = `USDA Branded Foods pipeline — summary (${new Date().toISOString().slice(0, 10)})

Rows in (food.csv total):          ${counts.foodRows.toLocaleString()}
Branded rows matched:              ${counts.brandedRows.toLocaleString()}
Dropped — discontinued:            ${counts.droppedDiscontinued.toLocaleString()}
Dropped — non-US market:           ${counts.droppedCountry.toLocaleString()}
Dropped — category filter:         ${counts.droppedCategory.toLocaleString()}
Dropped — brand filter:            ${counts.droppedBrandFilter.toLocaleString()}
Dropped — serving basis not g/ml:  ${counts.droppedBadBasis.toLocaleString()}
Dropped — incomplete macros:       ${counts.droppedIncompleteMacros.toLocaleString()}
Dropped — missing name:            ${counts.droppedMissingName.toLocaleString()}
Rows assembled:                    ${counts.assembled.toLocaleString()}

Canonical foods (groups out):      ${counts.groups.toLocaleString()}
Flagged for review:                ${counts.flaggedGroups.toLocaleString()}  → flagged-groups.ndjson
Search-token rows:                 ${counts.tokenRows.toLocaleString()}
Brand rows:                        ${counts.brandRows.toLocaleString()}

Estimated D1 size:                 ~${estimatedMb} MB
Total D1 row writes for load:      ${totalWrites.toLocaleString()}
  (Workers Paid includes 50M writes/month — a full load fits in one run.)

Review canonical-foods.ndjson / preview.csv / flagged-groups.ndjson before
building SQL. Next step:
  node src/build-sql.mjs --in ${join(outDir, "canonical-foods.ndjson")} --sql ${join(outDir, "sql")}
`;
createWriteStream(join(outDir, "summary.txt")).end(summary);
console.log("\n" + summary);
log("Done.");
