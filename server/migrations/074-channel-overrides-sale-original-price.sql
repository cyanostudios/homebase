-- 074-channel-overrides-sale-original-price.sql
-- Per-instance sale_price (WooCommerce Reapris) and original_price (Fyndiq Originalpris).
-- No change to existing price_amount / baspris logic.

ALTER TABLE channel_product_overrides
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(12,2);
