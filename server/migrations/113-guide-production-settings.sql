-- 113-guide-production-settings.sql
-- Per-tenant Guides production worker on/off + poll interval

CREATE TABLE IF NOT EXISTS guide_production_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  worker_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  poll_interval_ms INT NOT NULL DEFAULT 5000,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id),
  CONSTRAINT guide_production_settings_poll_interval_ms_check
    CHECK (poll_interval_ms IN (5000, 15000, 30000, 60000, 300000))
);

CREATE INDEX IF NOT EXISTS idx_guide_production_settings_user_id
  ON guide_production_settings(user_id);
