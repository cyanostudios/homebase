-- 013-fyndiq.sql
-- Fyndiq connector settings (legacy user_id-scoped at creation time)

CREATE TABLE IF NOT EXISTS fyndiq_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_fyndiq_settings_user_id
  ON fyndiq_settings(user_id);

