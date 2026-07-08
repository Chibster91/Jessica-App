-- Adds the columns needed to load OpenNutrition data (replacing the
-- USDA-branded-CSV source from 0001). fdc_id stays the primary key but is
-- now a synthetic surrogate id (see scripts/food-pipeline/src/surrogateId.mjs)
-- rather than a real USDA FDC id.

ALTER TABLE foods ADD COLUMN source_id TEXT;        -- OpenNutrition's own id ("fd_..."), for idempotent reloads
ALTER TABLE foods ADD COLUMN barcode TEXT;           -- ean_13, when present
ALTER TABLE foods ADD COLUMN food_type TEXT;         -- grocery | everyday | restaurant | prepared

CREATE UNIQUE INDEX idx_foods_source_id ON foods(source_id);
CREATE INDEX idx_foods_barcode ON foods(barcode);
