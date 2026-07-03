// Streaming RFC-4180 CSV parser. USDA bulk files have quoted fields containing
// commas, escaped quotes ("") and embedded newlines, so a readline split is not
// enough. Yields one string[] per record; handles LF and CRLF; tolerates a
// missing trailing newline. Processes chunk-by-chunk so multi-GB files never
// live in memory.

import { createReadStream } from "node:fs";

export async function* parseCsvStream(stream) {
  let field = "";
  let row = [];
  let inQuotes = false;
  // Tracks a quote seen while inQuotes: either an escaped "" or the closing quote.
  let pendingQuote = false;

  for await (const chunk of stream) {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (inQuotes) {
        if (pendingQuote) {
          pendingQuote = false;
          if (ch === '"') {
            field += '"';
            continue;
          }
          inQuotes = false;
          // fall through: ch is a normal structural character now
        } else if (ch === '"') {
          pendingQuote = true;
          continue;
        } else {
          field += ch;
          continue;
        }
      }

      if (ch === '"' && field === "") {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
        field = "";
        yield row;
        row = [];
      } else {
        field += ch;
      }
    }
  }

  // Flush a final record with no trailing newline (or a dangling closing quote).
  if (pendingQuote) inQuotes = false;
  if (field !== "" || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    yield row;
  }
}

export async function* parseCsvFile(path) {
  yield* parseCsvStream(createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 }));
}

/** Read the header row and return a name -> column index map (lowercased names). */
export function headerIndex(headerRow) {
  const map = new Map();
  headerRow.forEach((name, i) => map.set(String(name).trim().toLowerCase(), i));
  return map;
}

/** Assert the header contains the given column names; throws a friendly error. */
export function requireColumns(map, columns, fileLabel) {
  const missing = columns.filter((c) => !map.has(c));
  if (missing.length > 0) {
    throw new Error(
      `${fileLabel}: expected columns [${missing.join(", ")}] were not found. ` +
        `USDA may have changed the file layout — found columns: ${[...map.keys()].join(", ")}`
    );
  }
}
