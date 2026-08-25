-- 152-garment-inventory-variant-identity-nonunique.sql
-- Audience + color + size may repeat on the same item (warn in UI only).
-- Drops the unique index introduced/replaced in 137/149.

DROP INDEX IF EXISTS idx_garment_inventory_variants_unique;
