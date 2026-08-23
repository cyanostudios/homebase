-- 138-garment-inventory-variant-sku-unique.sql
-- Non-empty SKUs must be unique per inventory item (case-insensitive).

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_inventory_variants_sku_unique
  ON garment_inventory_variants (item_id, lower(sku))
  WHERE btrim(sku) <> '';
