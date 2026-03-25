-- Reduce repeated order rewrites for active-order sync and speed up Woo product map lookups.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS sync_fingerprint VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_channel_product_map_user_channel_instance_external_id
  ON channel_product_map (user_id, channel, channel_instance_id, external_id)
  WHERE external_id IS NOT NULL;
