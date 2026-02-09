-- 033-sync-tenant-schema-with-public.sql
-- Lägger till kolumner som public har men tenant saknar (för migrering public->tenant).
-- Inga fallbacklösningar – schemat synkas så att all data kan kopieras.

-- contacts: f_tax (public har den)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS f_tax VARCHAR(50);

-- channel_error_log: error_code, occurred_at
ALTER TABLE channel_error_log ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);
ALTER TABLE channel_error_log ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMP;

-- mail_log: resend_email_id, reply_token
ALTER TABLE mail_log ADD COLUMN IF NOT EXISTS resend_email_id VARCHAR(255);
ALTER TABLE mail_log ADD COLUMN IF NOT EXISTS reply_token VARCHAR(255);

-- mail_settings: resend_reply_to_address (026 lade till resend_* men inte denna)
ALTER TABLE mail_settings ADD COLUMN IF NOT EXISTS resend_reply_to_address VARCHAR(255);
