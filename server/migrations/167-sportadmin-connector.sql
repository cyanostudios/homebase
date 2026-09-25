-- 167-sportadmin-connector.sql
-- Tenant DB: SportAdmin connector config, cached resources, sync errors.

CREATE TABLE IF NOT EXISTS sportadmin_config (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  site_url TEXT,
  refresh_interval_minutes INT NOT NULL DEFAULT 1440,
  cron_enabled BOOLEAN NOT NULL DEFAULT false,
  last_successful_sync TIMESTAMPTZ,
  last_attempted_sync TIMESTAMPTZ,
  last_error TEXT,
  connection_test JSONB,
  discovery_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sportadmin_config_refresh_interval_chk
    CHECK (refresh_interval_minutes IN (15, 30, 60, 360, 1440))
);

CREATE TABLE IF NOT EXISTS sportadmin_resources (
  id TEXT PRIMARY KEY,
  user_id INT NOT NULL,
  source TEXT NOT NULL DEFAULT 'sportadmin',
  source_id TEXT NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  source_image_url TEXT,
  content_hash TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sportadmin_resources_type_chk
    CHECK (type IN ('organization', 'team', 'page', 'news', 'match', 'event', 'link'))
);

CREATE UNIQUE INDEX IF NOT EXISTS sportadmin_resources_user_type_source_idx
  ON sportadmin_resources (user_id, type, source_id);

CREATE INDEX IF NOT EXISTS sportadmin_resources_user_type_idx
  ON sportadmin_resources (user_id, type);

CREATE TABLE IF NOT EXISTS sportadmin_sync_errors (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  resource TEXT NOT NULL,
  status INT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sportadmin_sync_errors_user_created_idx
  ON sportadmin_sync_errors (user_id, created_at DESC);
