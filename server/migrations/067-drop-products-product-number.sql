-- 067-drop-products-product-number.sql
-- Ta bort product_number; identifiering sker via id, sync mot WooCommerce/Sello via sku/sello-id.

DROP INDEX IF EXISTS idx_products_product_number;
DROP INDEX IF EXISTS ux_products_user_product_number;
ALTER TABLE products DROP COLUMN IF EXISTS product_number;
