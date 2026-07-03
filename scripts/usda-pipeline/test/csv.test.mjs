import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { parseCsvStream, headerIndex, requireColumns } from "../src/csv.mjs";

async function parse(text, chunkSize = 7) {
  // Small chunks on purpose: exercises quotes/newlines split across chunk boundaries.
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) chunks.push(text.slice(i, i + chunkSize));
  const rows = [];
  for await (const row of parseCsvStream(Readable.from(chunks))) rows.push(row);
  return rows;
}

test("plain rows with LF and CRLF", async () => {
  assert.deepEqual(await parse("a,b,c\n1,2,3\r\n4,5,6\n"), [["a", "b", "c"], ["1", "2", "3"], ["4", "5", "6"]]);
});

test("quoted fields with commas", async () => {
  assert.deepEqual(await parse('id,name\n1,"Coke, Diet"\n'), [["id", "name"], ["1", "Coke, Diet"]]);
});

test("escaped quotes inside quoted fields", async () => {
  assert.deepEqual(await parse('1,"say ""hi"" now"\n'), [["1", 'say "hi" now']]);
});

test("embedded newlines inside quoted fields", async () => {
  assert.deepEqual(await parse('1,"line one\nline two",3\n'), [["1", "line one\nline two", "3"]]);
});

test("no trailing newline still yields the last row", async () => {
  assert.deepEqual(await parse("a,b\n1,2"), [["a", "b"], ["1", "2"]]);
});

test("empty fields survive", async () => {
  assert.deepEqual(await parse("a,,c\n,,\n"), [["a", "", "c"], ["", "", ""]]);
});

test("headerIndex + requireColumns", async () => {
  const map = headerIndex(["fdc_id", "Data_Type", "description"]);
  assert.equal(map.get("data_type"), 1);
  assert.throws(() => requireColumns(map, ["missing_col"], "food.csv"), /missing_col/);
});
