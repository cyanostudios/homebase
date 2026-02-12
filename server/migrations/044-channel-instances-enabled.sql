-- 044-channel-instances-enabled.sql
-- Add enabled flag so Channels UI can activate/deactivate markets (SE, DK, FI, NO).
-- listInstances filters by enabled = true so Products/Orders/export only see active instances.

ALTER TABLE channel_instances ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT true;

UPDATE channel_instances SET enabled = true WHERE enabled IS NULL;

CREATE INDEX IF NOT EXISTS idx_channel_instances_enabled
  ON channel_instances(user_id, channel, enabled) WHERE enabled = true;
