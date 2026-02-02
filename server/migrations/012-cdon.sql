-- 012-cdon.sql
-- CDON connector settings (per-user)

CREATE TABLE IF NOT EXISTS cdon_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_cdon_settings_user_id
  ON cdon_settings(user_id);

