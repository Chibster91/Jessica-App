-- Canonical branded foods produced by scripts/usda-pipeline.
-- fdc_id is the representative row's real FDC id, so /detail can always fall
-- back to live USDA for ids that aren't (or are no longer) in this table.

CREATE TABLE foods (
  fdc_id            INTEGER PRIMARY KEY,
  name              TEXT NOT NULL,          -- cleaned display name
  brand_owner       TEXT,
  brand_name        TEXT,
  category          TEXT,
  ingredients       TEXT,
  serving_size      REAL,                   -- label serving amount
  serving_size_unit TEXT,                   -- 'g' | 'ml'
  household_serving TEXT,
  publication_date  TEXT,
  calories          REAL NOT NULL,          -- per 100 g/ml (modal across dupes)
  protein           REAL NOT NULL,
  carbs             REAL NOT NULL,
  fat               REAL NOT NULL,
  fiber             REAL,
  sodium            REAL,
  sugars            REAL,
  portions_json     TEXT,                   -- JSON FoodPortion[] (package sizes)
  quality           INTEGER NOT NULL DEFAULT 0,
  group_size        INTEGER NOT NULL DEFAULT 1
);

-- Inverted search index: one row per (token, food). rank is a static
-- quality/popularity score so per-token reads can be capped by ORDER BY rank.
CREATE TABLE food_tokens (
  token  TEXT NOT NULL,
  rank   INTEGER NOT NULL,
  fdc_id INTEGER NOT NULL
);
CREATE INDEX idx_tokens ON food_tokens(token, rank DESC, fdc_id);

-- Brand-intent lookup: normalized brand phrases -> display brand name.
CREATE TABLE brands (
  token      TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL
) WITHOUT ROWID;
