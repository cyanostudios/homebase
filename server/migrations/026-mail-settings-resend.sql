-- 026-mail-settings-resend.sql
-- Add Resend provider support to mail_settings

ALTER TABLE mail_settings
  ADD COLUMN IF NOT EXISTS provider VARCHAR(50) NOT NULL DEFAULT 'smtp',
  ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
  ADD COLUMN IF NOT EXISTS resend_from_address VARCHAR(255);
