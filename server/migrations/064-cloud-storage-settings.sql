-- 064-cloud-storage-settings.sql
-- OAuth account settings for cloud storage (used by plugins/files OAuth + storage adapters)

CREATE TABLE IF NOT EXISTS googledrive_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_googledrive_settings_user_id ON googledrive_settings(user_id);

CREATE TABLE IF NOT EXISTS onedrive_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_onedrive_settings_user_id ON onedrive_settings(user_id);

CREATE TABLE IF NOT EXISTS dropbox_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  client_id TEXT,
  client_secret TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dropbox_settings_user_id ON dropbox_settings(user_id);
