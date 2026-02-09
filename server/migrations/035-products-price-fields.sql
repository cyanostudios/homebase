-- 035-products-price-fields.sql
-- Add purchase_price and sale_price to products (standard = price_amount)

ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2);
