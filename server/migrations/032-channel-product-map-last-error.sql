-- 032-channel-product-map-last-error.sql
-- Add last_error if missing (some installs created table from older schema).
-- Orders uses channel, enabled, external_id, channel_instance_id only; last_error is for sync status.
-- Safe: additive, no impact on Orders/Woo order sync.

ALTER TABLE channel_product_map ADD COLUMN IF NOT EXISTS last_error TEXT;
