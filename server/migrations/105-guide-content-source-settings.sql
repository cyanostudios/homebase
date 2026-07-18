-- 105-guide-content-source-settings.sql
-- Tenant-scoped enable/disable overrides for guide research content sources

CREATE TABLE IF NOT EXISTS guide_content_source_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  source_key VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, source_key)
);

CREATE INDEX IF NOT EXISTS idx_guide_content_source_settings_user_id
  ON guide_content_source_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_guide_content_source_settings_source_key
  ON guide_content_source_settings(source_key);
