-- 030-channel-product-map-instance-unique.sql
-- Allow multiple rows per product per channel (one per Woo instance).
-- Drop old unique constraint and add new one including channel_instance_id.
-- NULLS NOT DISTINCT: one row per (product, channel) when channel_instance_id IS NULL (CDON/Fyndiq).

DROP INDEX IF EXISTS ux_channel_product_map_user_product_channel;

CREATE UNIQUE INDEX ux_channel_product_map_user_product_channel_instance
  ON channel_product_map (user_id, product_id, channel, channel_instance_id) NULLS NOT DISTINCT;
