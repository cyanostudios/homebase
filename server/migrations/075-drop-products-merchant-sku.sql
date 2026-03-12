-- 075-drop-products-merchant-sku.sql
-- Ta bort merchant_sku; kolumnen används inte (sku/mpn används, Sello private_reference matar båda vid import).

DROP INDEX IF EXISTS idx_products_merchant_sku;
ALTER TABLE products DROP COLUMN IF EXISTS merchant_sku;
