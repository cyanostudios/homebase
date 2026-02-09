-- 028-user-settings.sql
-- User settings (profile, preferences, etc.) stored per user and category.
-- Used by /api/settings (main pool, public schema).

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_category ON user_settings(category);
