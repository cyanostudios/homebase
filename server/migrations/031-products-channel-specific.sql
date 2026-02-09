-- 031-products-channel-specific.sql
-- Optional JSON column for CDON/Fyndiq/Woo-specific attributes (e.g. googleCategory, shippingCost).

ALTER TABLE products ADD COLUMN IF NOT EXISTS channel_specific JSONB DEFAULT NULL;

COMMENT ON COLUMN products.channel_specific IS 'Channel-specific attributes: cdon, fyndiq, woocommerce keys with arbitrary JSON';
