-- 025-mail-settings.sql
-- Per-user SMTP settings (configured in Mail plugin UI)

CREATE TABLE IF NOT EXISTS mail_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  host VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
  port INT NOT NULL DEFAULT 587,
  secure BOOLEAN NOT NULL DEFAULT FALSE,
  auth_user VARCHAR(255),
  auth_pass TEXT,
  from_address VARCHAR(255) NOT NULL DEFAULT 'noreply@homebase.se',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_mail_settings_user_id ON mail_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_mail_settings_user_id ON mail_settings(user_id);
