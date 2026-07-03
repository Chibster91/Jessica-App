#!/usr/bin/env node
// Turns reviewed canonical-foods.ndjson (+ brands.ndjson) into chunked SQL
// files for `wrangler d1 execute --file`. Each INSERT statement stays under
// D1's 100 KB statement limit; each file stays a few MB so a failed chunk is
// cheap to retry. INSERT OR REPLACE makes reloads idempotent.
//
// Usage: node src/build-sql.mjs --in ./out/canonical-foods.ndjson --sql ./out/sql

import { createReadStream, createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, dirname } from "node:path";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    in: { type: "string" },
    sql: { type: "string" },
    "chunk-mb": { type: "string", default: "8" },
  },
});
if (!args.in || !args.sql) {
  console.error("Usage: node src/build-sql.mjs --in ./out/canonical-foods.ndjson --sql ./out/sql");
  process.exit(1);
}
if (!existsSync(args.in)) {
  console.error(`Input not found: ${args.in} — run src/run.mjs first.`);
  process.exit(1);
}
mkdirSync(args.sql, { recursive: true });

const MAX_STATEMENT_BYTES = 90_000; // headroom under D1's 100 KB limit
const MAX_FILE_BYTES = Number(args["chunk-mb"]) * 1048576;

const q = (value) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
};

class SqlChunker {
  constructor(dir, label) {
    this.dir = dir;
    this.label = label;
    this.fileIndex = 0;
    this.stream = null;
    this.fileBytes = 0;
    this.statement = "";
    this.statementRows = 0;
    this.prefix = "";
    this.files = [];
  }
  openFile() {
    this.fileIndex++;
    const name = `${this.label}-${String(this.fileIndex).padStart(4, "0")}.sql`;
    this.stream = createWriteStream(join(this.dir, name));
    this.fileBytes = 0;
    this.files.push(name);
  }
  add(prefix, valuesTuple) {
    if (!this.stream) this.openFile();
    if (this.statement && (this.prefix !== prefix || this.statement.length + valuesTuple.length > MAX_STATEMENT_BYTES)) {
      this.flushStatement();
    }
    if (!this.statement) {
      this.prefix = prefix;
      this.statement = prefix + valuesTuple;
    } else {
      this.statement += "," + valuesTuple;
    }
    this.statementRows++;
  }
  flushStatement() {
    if (!this.statement) return;
    const text = this.statement + ";\n";
    this.stream.write(text);
    this.fileBytes += text.length;
    this.statement = "";
    this.statementRows = 0;
    if (this.fileBytes >= MAX_FILE_BYTES) {
      this.stream.end();
      this.stream = null;
    }
  }
  close() {
    this.flushStatement();
    if (this.stream) this.stream.end();
  }
}

const chunker = new SqlChunker(args.sql, "data");
const FOODS_PREFIX =
  "INSERT OR REPLACE INTO foods (fdc_id,name,brand_owner,brand_name,category,ingredients,serving_size,serving_size_unit,household_serving,publication_date,calories,protein,carbs,fat,fiber,sodium,sugars,portions_json,quality,group_size) VALUES ";
const TOKENS_PREFIX = "INSERT INTO food_tokens (token,rank,fdc_id) VALUES ";
const BRANDS_PREFIX = "INSERT OR REPLACE INTO brands (token,brand_name) VALUES ";

let foods = 0;
let tokenRows = 0;
let skippedMissingName = 0;

// Token rows are grouped after foods so a partial load still has usable food rows.
const tokenBacklog = [];

const rl = createInterface({ input: createReadStream(args.in), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const c = JSON.parse(line);
  if (!c.name) {
    skippedMissingName++;
    continue;
  }
  const n = c.per100;
  chunker.add(
    FOODS_PREFIX,
    `(${c.fdcId},${q(c.name)},${q(c.brandOwner)},${q(c.brandName)},${q(c.category)},${q(c.ingredients)},${q(c.servingSize)},${q(c.servingSizeUnit)},${q(c.householdServing)},${q(c.publicationDate)},${q(n.calories ?? 0)},${q(n.protein ?? 0)},${q(n.carbs ?? 0)},${q(n.fat ?? 0)},${q(n.fiber)},${q(n.sodium)},${q(n.sugars)},${q(JSON.stringify(c.portions ?? []))},${c.quality ?? 0},${c.groupSize ?? 1})`
  );
  foods++;
  for (const token of c.tokens ?? []) {
    tokenBacklog.push(`(${q(token)},${c.rank ?? 0},${c.fdcId})`);
    tokenRows++;
  }
  if (tokenBacklog.length >= 5000) {
    for (const tuple of tokenBacklog) chunker.add(TOKENS_PREFIX, tuple);
    tokenBacklog.length = 0;
  }
}
for (const tuple of tokenBacklog) chunker.add(TOKENS_PREFIX, tuple);

// brands.ndjson (optional, produced by run.mjs alongside the canonical file)
const brandsPath = join(dirname(args.in), "brands.ndjson");
let brands = 0;
if (existsSync(brandsPath)) {
  for (const line of readFileSync(brandsPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const b = JSON.parse(line);
    chunker.add(BRANDS_PREFIX, `(${q(b.token)},${q(b.brandName)})`);
    brands++;
  }
}
chunker.close();

// Wipe-first file so reloading replaces the token index instead of duplicating it.
createWriteStream(join(args.sql, "0000-reset-tokens.sql")).end("DELETE FROM food_tokens;\nDELETE FROM brands;\n");

console.log(
  `Wrote ${chunker.files.length + 1} SQL files to ${args.sql}\n` +
    `  foods: ${foods.toLocaleString()}  token rows: ${tokenRows.toLocaleString()}  brands: ${brands.toLocaleString()}\n` +
    (skippedMissingName ? `  skipped missing names: ${skippedMissingName.toLocaleString()}\n` : "") +
    `Next: node src/load.mjs --sql ${args.sql} --db jessica-foods --remote`
);
