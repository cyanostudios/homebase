-- 063-products-material-pattern-text.sql
-- Material (fritext från Sello property "Material") och pattern_text (mönster fritext).
-- pattern = Fyndiq/CDON preset, pattern_text = eget mönster när preset saknas.

ALTER TABLE products ADD COLUMN IF NOT EXISTS material VARCHAR(255);
ALTER TABLE products ADD COLUMN IF NOT EXISTS pattern_text VARCHAR(255);
