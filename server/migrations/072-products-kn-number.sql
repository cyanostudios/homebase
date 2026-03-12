-- 072-products-kn-number.sql
-- KN-nummer (Kombinerade nomenklaturen) – tullklassificering. Produktegenskap, samma för alla kanaler.

ALTER TABLE products ADD COLUMN IF NOT EXISTS kn_number VARCHAR(48);
