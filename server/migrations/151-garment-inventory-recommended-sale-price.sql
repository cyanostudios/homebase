-- 151-garment-inventory-recommended-sale-price.sql
-- Optional recommended (RRP) and sale prices on inventory items. No data wipe.

ALTER TABLE garment_inventory_items
  ADD COLUMN IF NOT EXISTS recommended_price NUMERIC(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2) NULL;
