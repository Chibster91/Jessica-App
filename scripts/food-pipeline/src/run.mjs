#!/usr/bin/env node
// OpenNutrition dataset ingestion. Streams the TSV and maps each row directly
// to a canonical food — OpenNutrition ships one row per product already, so
// (unlike the old USDA-CSV pipeline this replaced) there's no dedup-voting
// pass, and no need to hold the whole dataset in memory: each row is read,
// mapped, and written straight to canonical-foods.ndjson.
//
// Usage:
//   node --max-old-space-size=4096 src/run.mjs --data ./data --out ./out
//
// Flags:
//   --no-ingredients   don't carry ingredient text (smaller D1)
//   --max-rows N       keep only the top-N canonical foods by rank
//   --types "grocery,everyday,restaurant,prepared"   filter by OpenNutrition
//                      type (default: all four)

import { createWriteStream, existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { parseCsvFile, headerIndex, requireColumns } from "./csv.mjs";
import { normalizeName, displayName, canonicalUnit } from "./normalizeName.mjs";
import { validBasis } from "./fingerprint.mjs";
import { splitGroceryBrand } from "./brandSplit.mjs";
import { extractTokens, normalizeForMatching } from "./tokens.mjs";
import { buildPortions } from "./portions.mjs";
import { assignSurrogateId } from "./surrogateId.mjs";

const NUTRITION_FIELDS = {
  calories: "calories",
  protein: "protein",
  carbs: "carbohydrates",
  fat: "total_fat",
  fiber: "dietary_fiber",
  sodium: "sodium",
  sugars: "total_sugars",
};

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
    "no-ingredients": { type: "boolean", default: false },
    "max-rows": { type: "string" },
    types: { type: "string" },
  },
});

if (!args.data || !args.out) fail("Required: --data <dir with opennutrition_foods.tsv> --out <output dir>");

const dataDir = args.data;
const outDir = args.out;
const tsvPath = join(dataDir, "opennutrition_foods.tsv");
if (!existsSync(tsvPath)) {
  fail(
    `${tsvPath} not found.\n` +
      `Download opennutrition_foods.tsv from https://www.opennutrition.app and place it in ${dataDir}/`
  );
}
mkdirSync(outDir, { recursive: true });

const maxRows = args["max-rows"] ? Number(args["max-rows"]) : null;
const typeFilter = args.types
  ? new Set(args.types.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))
  : null;

const counts = {
  rows: 0,
  droppedType: 0,
  droppedBadJson: 0,
  droppedIncompleteMacros: 0,
  droppedMissingName: 0,
  assembled: 0,
  tokenRows: 0,
  brandRows: 0,
};

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** {amount, unit} candidate for buildPortions, only if the unit is one
 * sizeToBasisAmount actually understands for the given basis. */
function sizeCandidate(sizeField, basisUnit) {
  if (!sizeField) return null;
  const unit = canonicalUnit(String(sizeField.unit ?? ""));
  const amount = Number(sizeField.quantity);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const supported = basisUnit === "ml" ? new Set(["fl oz", "liter", "ml"]) : new Set(["oz", "lb", "kg", "g"]);
  if (!supported.has(unit)) return null;
  return { amount, unit };
}

const takenIds = new Set();
const brandCounts = new Map(); // normalized brand token -> { display, count }
// Lightweight per-row summary for preview.csv (top 2000 by rank) and, when
// --max-rows is set, the rank cutoff — kept small on purpose so it never
// approaches the size of the full dataset in memory.
const summaryRows = [];

const rawOutPath = maxRows ? join(outDir, ".canonical-foods.unfiltered.ndjson") : join(outDir, "canonical-foods.ndjson");
const canonicalOut = createWriteStream(rawOutPath);
let foodsBytes = 0;

log("Streaming opennutrition_foods.tsv…");
let cols = null;
{
  let header = null;
  for await (const row of parseCsvFile(tsvPath, "\t")) {
    if (!header) {
      header = row;
      cols = headerIndex(row);
      requireColumns(cols, ["id", "name", "type", "nutrition_100g", "serving"], "opennutrition_foods.tsv");
      continue;
    }
    counts.rows++;
    if (counts.rows % 50000 === 0) log(`  …${counts.rows.toLocaleString()} rows`);

    const col = (name) => row[cols.get(name)] ?? "";
    const sourceId = col("id");
    const type = col("type").trim().toLowerCase();
    if (typeFilter && !typeFilter.has(type)) {
      counts.droppedType++;
      continue;
    }

    const rawName = col("name").trim();
    if (!rawName) {
      counts.droppedMissingName++;
      continue;
    }

    const nutritionJson = parseJsonSafe(col("nutrition_100g"));
    const servingJson = parseJsonSafe(col("serving"));
    const packageJson = parseJsonSafe(col("package_size"));
    if (!nutritionJson) {
      counts.droppedBadJson++;
      continue;
    }

    const calories = toNum(nutritionJson[NUTRITION_FIELDS.calories]);
    const protein = toNum(nutritionJson[NUTRITION_FIELDS.protein]);
    const carbs = toNum(nutritionJson[NUTRITION_FIELDS.carbs]);
    const fat = toNum(nutritionJson[NUTRITION_FIELDS.fat]);
    if (calories === undefined || protein === undefined || carbs === undefined || fat === undefined) {
      counts.droppedIncompleteMacros++;
      continue;
    }
    const nutrition = {
      calories,
      protein,
      carbs,
      fat,
      fiber: toNum(nutritionJson[NUTRITION_FIELDS.fiber]),
      sodium: toNum(nutritionJson[NUTRITION_FIELDS.sodium]),
      sugars: toNum(nutritionJson[NUTRITION_FIELDS.sugars]),
    };
    const quality = [calories, protein, carbs, fat, nutrition.fiber, nutrition.sodium, nutrition.sugars].filter(
      (v) => v !== undefined
    ).length;

    const { productName, brand } = splitGroceryBrand(rawName, type);
    const name = displayName(productName) || productName;
    const { normalized, packageSizes: nameSizes, containers } = normalizeName(productName);

    const basisUnit = validBasis(servingJson?.metric?.unit);
    const servingSize = basisUnit ? toNum(servingJson?.metric?.quantity) ?? null : null;
    const common = servingJson?.common;
    const householdServing =
      common && Number.isFinite(Number(common.quantity)) && common.unit
        ? `${common.quantity} ${common.unit}`
        : null;

    const pkgCandidate = basisUnit
      ? sizeCandidate(packageJson?.common, basisUnit) ?? sizeCandidate(packageJson?.metric, basisUnit)
      : null;
    const portions = buildPortions(
      [{ packageSizes: pkgCandidate ? [...nameSizes, pkgCandidate] : nameSizes, containers }],
      basisUnit ?? "g",
      { householdServing, servingSize }
    );

    const nameTokens = extractTokens({ normalizedName: normalized, brandName: brand, brandOwner: brand, category: null });
    const altNamesJson = parseJsonSafe(col("alternate_names"));
    const altNames = Array.isArray(altNamesJson) ? altNamesJson : [];
    const tokenSet = new Set(nameTokens);
    outer: for (const alt of altNames) {
      for (const word of normalizeForMatching(alt).split(/\s+/)) {
        if (word.length > 1 && !/^\d+$/.test(word)) tokenSet.add(word);
        if (tokenSet.size >= 24) break outer;
      }
    }

    const fdcId = assignSurrogateId(takenIds, sourceId);
    const ingredientsText = col("ingredients").trim();
    const barcode = col("ean_13").trim();
    const rank = quality * 2 + 1;

    const canonical = {
      fdcId,
      sourceId,
      name,
      originalName: rawName,
      brandOwner: brand,
      brandName: brand,
      category: null,
      foodType: type,
      ingredients: args["no-ingredients"] || !ingredientsText ? null : ingredientsText.slice(0, 256),
      servingSize,
      servingSizeUnit: basisUnit,
      householdServing,
      publicationDate: null,
      barcode: barcode || null,
      per100: nutrition,
      portions,
      quality,
      groupSize: 1,
      rank,
      flagged: false,
      tokens: [...tokenSet],
      sourceFdcIds: [fdcId],
    };

    const line = JSON.stringify(canonical);
    canonicalOut.write(line + "\n");
    foodsBytes += line.length + 60;
    counts.tokenRows += canonical.tokens.length;
    counts.assembled++;

    summaryRows.push({ fdcId, name, brandName: brand, foodType: type, per100: nutrition, barcode: canonical.barcode, rank });

    if (brand) {
      const brandToken = normalizeForMatching(brand);
      if (brandToken.length >= 3) {
        const existing = brandCounts.get(brandToken);
        if (existing) existing.count++;
        else brandCounts.set(brandToken, { display: brand, count: 1 });
      }
    }
  }
}
await new Promise((resolve) => canonicalOut.end(resolve));
log(`Streaming done: ${counts.assembled.toLocaleString()} canonical foods assembled`);

// --max-rows: figure out the rank cutoff from the lightweight summary, then
// filter the already-written file down in a second streaming pass (never
// holds the full dataset — only the kept ids — in memory at once).
if (maxRows && counts.assembled > maxRows) {
  log(`Applying --max-rows ${maxRows}…`);
  const sorted = [...summaryRows].sort((a, b) => b.rank - a.rank).slice(0, maxRows);
  const keepIds = new Set(sorted.map((r) => r.fdcId));
  const finalPath = join(outDir, "canonical-foods.ndjson");
  const filteredOut = createWriteStream(finalPath);
  const rl = createInterface({ input: createReadStream(rawOutPath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const fdcId = JSON.parse(line).fdcId;
    if (keepIds.has(fdcId)) filteredOut.write(line + "\n");
  }
  await new Promise((resolve) => filteredOut.end(resolve));
  unlinkSync(rawOutPath);
  counts.assembled = keepIds.size;
  log(`--max-rows filter done: ${counts.assembled.toLocaleString()} foods kept`);
} else if (maxRows) {
  renameSync(rawOutPath, join(outDir, "canonical-foods.ndjson"));
}

// No flagged-groups.ndjson — there's nothing to dedup-vote on with one row per product.
createWriteStream(join(outDir, "flagged-groups.ndjson")).end("");

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
  const preview = [...summaryRows].sort((a, b) => b.rank - a.rank).slice(0, 2000);
  const lines = ["fdc_id,name,brand,food_type,kcal_per_100,protein,carbs,fat,barcode"];
  for (const c of preview) {
    const esc = (s) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    lines.push(
      [c.fdcId, esc(c.name), esc(c.brandName), esc(c.foodType), c.per100.calories, c.per100.protein, c.per100.carbs, c.per100.fat, esc(c.barcode)].join(",")
    );
  }
  createWriteStream(join(outDir, "preview.csv")).end(lines.join("\n") + "\n");
}

// summary.txt
const tokenBytes = counts.tokenRows * 40;
const estimatedMb = ((foodsBytes + tokenBytes) / 1048576).toFixed(0);
const totalWrites = counts.assembled + counts.tokenRows + counts.brandRows;
const summary = `OpenNutrition ingestion — summary (${new Date().toISOString().slice(0, 10)})

Rows scanned:                      ${counts.rows.toLocaleString()}
Dropped — type filter:             ${counts.droppedType.toLocaleString()}
Dropped — unparseable JSON:        ${counts.droppedBadJson.toLocaleString()}
Dropped — incomplete macros:       ${counts.droppedIncompleteMacros.toLocaleString()}
Dropped — missing name:            ${counts.droppedMissingName.toLocaleString()}

Canonical foods:                   ${counts.assembled.toLocaleString()}
Search-token rows:                 ${counts.tokenRows.toLocaleString()}${maxRows ? " (pre --max-rows estimate)" : ""}
Brand rows:                        ${counts.brandRows.toLocaleString()}

Estimated D1 size:                 ~${estimatedMb} MB
Total D1 row writes for load:      ${totalWrites.toLocaleString()}
  (Workers Paid includes 50M writes/month — a full load fits in one run.)

Review canonical-foods.ndjson / preview.csv before building SQL. Next step:
  node src/build-sql.mjs --in ${join(outDir, "canonical-foods.ndjson")} --sql ${join(outDir, "sql")}
`;
createWriteStream(join(outDir, "summary.txt")).end(summary);
console.log("\n" + summary);
log("Done.");
