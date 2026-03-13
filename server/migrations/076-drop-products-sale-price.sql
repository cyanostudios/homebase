-- Drop products.sale_price (unused; Reapris per kanal ligger i channel_product_overrides)
ALTER TABLE products DROP COLUMN IF EXISTS sale_price;
