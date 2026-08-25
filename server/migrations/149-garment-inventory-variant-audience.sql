-- 149-garment-inventory-variant-audience.sql
-- Optional audience (Women / Men / Kids / …) on variants.
-- Uniqueness becomes (item_id, audience, color, size) case-insensitive.

ALTER TABLE garment_inventory_variants
  ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS idx_garment_inventory_variants_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_inventory_variants_unique
  ON garment_inventory_variants (item_id, lower(audience), lower(color), lower(size));
