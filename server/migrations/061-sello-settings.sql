-- 061-sello-settings.sql
-- Sello API settings (per-user) for product import.
-- api_key: encrypted; format is "key:secret" for Authorization header.

CREATE TABLE IF NOT EXISTS sello_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  api_key TEXT,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_sello_settings_user_id
  ON sello_settings(user_id);
