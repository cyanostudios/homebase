-- Optional barcode on each inventory variant (Garments and Clubdesk).
-- Empty string means no GTIN. The API accepts 8, 12, 13, or 14 digits.

ALTER TABLE garment_inventory_variants
  ADD COLUMN IF NOT EXISTS gtin TEXT NOT NULL DEFAULT '';

ALTER TABLE clubdesk_inventory_variants
  ADD COLUMN IF NOT EXISTS gtin TEXT NOT NULL DEFAULT '';
