-- 041-products-detail-fields.sql
-- Detaljer: Färg, Färgtext, Storlek, Storlekstext, Fyndiq-mönster (pattern), Vikt, Längd, Bredd, Höjd, Djup

ALTER TABLE products ADD COLUMN IF NOT EXISTS color VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS color_text VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS size VARCHAR(50);
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_text VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS pattern VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight NUMERIC(12,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS length_cm NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS width_cm NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS height_cm NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS depth_cm NUMERIC(12,2);
