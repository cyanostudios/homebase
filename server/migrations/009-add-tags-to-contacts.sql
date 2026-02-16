-- 009-add-tags-to-contacts.sql
-- Adds tags to contacts (multi-tag support)

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

