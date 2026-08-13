-- 130-cups-site-config.sql
-- Tenant-scoped site config for Cupappen (e.g. fallback cover image URLs).
-- Written by Homebase Cups settings; read by public-cups/api/fallback_images.php.

CREATE TABLE IF NOT EXISTS cups_site_config (
  user_id INTEGER NOT NULL,
  config_key VARCHAR(64) NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, config_key)
);

CREATE INDEX IF NOT EXISTS idx_cups_site_config_key
  ON cups_site_config (config_key);
