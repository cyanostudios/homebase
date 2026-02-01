-- 015-products-mpn.sql
-- Add MPN field to products (optional, future-proof identifier)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS mpn VARCHAR(255);

-- Backfill for existing rows so exports won't miss MPN.
-- If you later set a custom MPN, it will override this.
UPDATE products
SET mpn = sku
WHERE (mpn IS NULL OR mpn = '')
  AND (sku IS NOT NULL AND sku <> '');

CREATE INDEX IF NOT EXISTS idx_products_mpn
  ON products(mpn);

