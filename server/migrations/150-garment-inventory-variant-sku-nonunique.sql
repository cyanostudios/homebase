-- 150-garment-inventory-variant-sku-nonunique.sql
-- Article numbers (SKU) may repeat across variants on the same item.
-- Uniqueness remains on (audience, color, size) via idx_garment_inventory_variants_unique.

DROP INDEX IF EXISTS idx_garment_inventory_variants_sku_unique;
