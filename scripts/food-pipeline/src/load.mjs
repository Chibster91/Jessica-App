#!/usr/bin/env node
// Loads the SQL chunks produced by build-sql.mjs into D1 via wrangler,
// one file at a time, recording finished chunks in <sql>/.load-progress so a
// stopped or failed run resumes where it left off (just run the same command
// again). Uses the wrangler install inside jessica-worker/.
//
// Usage: node src/load.mjs --sql ./out/sql --db jessica-foods --remote
//        node src/load.mjs --sql ./out/sql --db jessica-foods --local   (testing)

import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    sql: { type: "string" },
    db: { type: "string", default: "jessica-foods" },
    remote: { type: "boolean", default: false },
    local: { type: "boolean", default: false },
  },
});
if (!args.sql || (!args.remote && !args.local)) {
  console.error("Usage: node src/load.mjs --sql ./out/sql --db jessica-foods --remote|--local");
  process.exit(1);
}

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../../jessica-worker");
if (!existsSync(join(workerDir, "wrangler.jsonc"))) {
  console.error(`Could not find jessica-worker at ${workerDir}`);
  process.exit(1);
}

const sqlDir = resolve(args.sql);
const progressPath = join(sqlDir, ".load-progress");
const done = new Set(
  existsSync(progressPath) ? readFileSync(progressPath, "utf8").split("\n").filter(Boolean) : []
);

const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql")).sort();
if (files.length === 0) {
  console.error(`No .sql files in ${sqlDir} — run build-sql.mjs first.`);
  process.exit(1);
}

const pending = files.filter((f) => !done.has(f));
console.log(`${files.length} chunks total, ${done.size} already loaded, ${pending.length} to go.\n`);

let loaded = 0;
for (const file of pending) {
  const target = args.remote ? "--remote" : "--local";
  process.stdout.write(`[${++loaded}/${pending.length}] ${file} … `);
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", args.db, target, "--file", join(sqlDir, file), "-y"],
    { cwd: workerDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  if (result.status !== 0) {
    console.log("FAILED");
    console.error(result.stderr || result.stdout);
    console.error(
      `\nChunk ${file} failed. Fix the issue (rate limit? network?) and re-run the same command — ` +
        `finished chunks are skipped automatically.`
    );
    process.exit(1);
  }
  appendFileSync(progressPath, file + "\n");
  console.log("ok");
}

console.log(`\nAll chunks loaded into ${args.db} (${args.remote ? "remote" : "local"}).`);
if (args.remote) console.log("Next: cd ../../jessica-worker && npm run deploy");
