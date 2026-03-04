-- 059-products-merchant-sku.sql
-- Merchant SKU: user's editable SKU (displayed as "SKU" in UI).
-- products.sku = Sello ID/Art.nr (immutable, used by channels).

ALTER TABLE products ADD COLUMN IF NOT EXISTS merchant_sku VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_products_merchant_sku ON products(merchant_sku) WHERE merchant_sku IS NOT NULL;
