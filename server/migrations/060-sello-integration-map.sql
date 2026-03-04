-- 060-sello-integration-map.sql
-- Map Sello integration IDs to Homebase channel_instances.
-- Used when building channel_product_map from Sello product integrations.item_id.

ALTER TABLE channel_instances ADD COLUMN IF NOT EXISTS sello_integration_id VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_channel_instances_sello_integration_id
  ON channel_instances(user_id, sello_integration_id)
  WHERE sello_integration_id IS NOT NULL;
