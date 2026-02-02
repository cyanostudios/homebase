-- 017-channel-instances.sql
-- Channel instances: multiple markets/stores per channel (Selloklon core).
-- Also migrates existing channel_product_overrides to reference instances.

CREATE TABLE IF NOT EXISTS channel_instances (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  channel VARCHAR(255) NOT NULL,
  instance_key VARCHAR(50) NOT NULL,
  market VARCHAR(10),      -- e.g. se/dk/fi when applicable
  label TEXT,              -- user-friendly label
  credentials JSONB,       -- channel-specific creds/config (future-proof)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_instances_user_channel_instance_key
  ON channel_instances(user_id, channel, instance_key);

CREATE INDEX IF NOT EXISTS idx_channel_instances_user_id
  ON channel_instances(user_id);

CREATE INDEX IF NOT EXISTS idx_channel_instances_channel
  ON channel_instances(channel);

-- Seed instances from existing overrides (so current imports keep working)
INSERT INTO channel_instances (user_id, channel, instance_key, market, label, credentials, created_at, updated_at)
SELECT
  o.user_id,
  o.channel,
  o.instance AS instance_key,
  CASE
    WHEN o.channel = 'cdon' AND lower(o.instance) IN ('se','dk','fi') THEN lower(o.instance)
    WHEN o.channel = 'fyndiq' AND lower(o.instance) IN ('se','dk','fi') THEN lower(o.instance)
    ELSE NULL
  END AS market,
  NULL AS label,
  NULL AS credentials,
  NOW(),
  NOW()
FROM channel_product_overrides o
LEFT JOIN channel_instances ci
  ON ci.user_id = o.user_id
 AND ci.channel = o.channel
 AND ci.instance_key = o.instance
WHERE ci.id IS NULL;

-- Add instance reference to overrides table
ALTER TABLE channel_product_overrides
  ADD COLUMN IF NOT EXISTS channel_instance_id INT;

-- Backfill channel_instance_id
UPDATE channel_product_overrides o
SET channel_instance_id = ci.id
FROM channel_instances ci
WHERE ci.user_id = o.user_id
  AND ci.channel = o.channel
  AND ci.instance_key = o.instance
  AND (o.channel_instance_id IS NULL OR o.channel_instance_id = 0);

-- Index and uniqueness by instance
CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_instance_id
  ON channel_product_overrides(channel_instance_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_overrides_instance_product
  ON channel_product_overrides(channel_instance_id, product_id);

