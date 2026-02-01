-- 011-products-sku-unique.sql
-- Ensure SKU uniqueness per user (idempotent).
--
-- Notes:
-- - SKU uniqueness is enforced per user_id.
-- - Allows SKU reuse after hard delete (normal behavior with a unique index).
-- - Does NOT reset any sequences; product IDs are never reused.

-- Create unique index if missing (matches 007-products.sql intent)
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_user_sku
  ON products(user_id, sku)
  WHERE sku IS NOT NULL;

