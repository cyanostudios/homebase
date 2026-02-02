-- 010-cloud-storage.sql
-- Cloud storage settings tables for OneDrive, Dropbox, and Google Drive integration
-- Supports both centralized OAuth apps (via env) and per-user OAuth apps (via user credentials)

-- OneDrive settings
CREATE TABLE IF NOT EXISTS onedrive_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  -- OAuth app credentials (optional - if not set, uses env vars)
  client_id TEXT,
  client_secret TEXT,
  -- OAuth tokens (per-user)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_onedrive_settings_user_id ON onedrive_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_onedrive_settings_user_id 
  ON onedrive_settings(user_id);

-- Dropbox settings
CREATE TABLE IF NOT EXISTS dropbox_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  -- OAuth app credentials (optional - if not set, uses env vars)
  client_id TEXT,
  client_secret TEXT,
  -- OAuth tokens (per-user)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dropbox_settings_user_id ON dropbox_settings(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_dropbox_settings_user_id 
  ON dropbox_settings(user_id);

-- Google Drive settings
CREATE TABLE IF NOT EXISTS googledrive_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  -- OAuth app credentials (optional - if not set, uses env vars)
  client_id TEXT,
  client_secret TEXT,
  -- OAuth tokens (per-user)
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
