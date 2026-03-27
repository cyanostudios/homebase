-- 010-cloud-storage.sql
-- Cloud storage settings for Google Drive integration
-- Supports both centralized OAuth apps (via env) and legacy user-owned OAuth app credentials

-- Google Drive settings
CREATE TABLE IF NOT EXISTS googledrive_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  -- OAuth app credentials (optional - if not set, uses env vars)
  client_id TEXT,
  client_secret TEXT,
  -- OAuth tokens (legacy user-owned at creation time)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_googledrive_settings_user_id ON googledrive_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_googledrive_settings_user_id 
  ON googledrive_settings(user_id);
