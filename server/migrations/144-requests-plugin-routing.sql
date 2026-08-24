-- 144-requests-plugin-routing.sql
-- Hybrid request → plugin routing (tenant). Snapshot target + intake payload + route audit.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS plugin_target TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS plugin_target_id TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS extra_data JSONB;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS plugin_routed_at TIMESTAMPTZ;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS plugin_routed_entity_id TEXT;

CREATE INDEX IF NOT EXISTS idx_requests_plugin_target
  ON requests (plugin_target) WHERE plugin_target IS NOT NULL;
