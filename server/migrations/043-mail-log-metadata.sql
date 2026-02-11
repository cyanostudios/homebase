-- 043-mail-log-metadata.sql
-- Add metadata column to mail_log to store additional info like file counts

ALTER TABLE mail_log ADD COLUMN IF NOT EXISTS metadata JSONB;
