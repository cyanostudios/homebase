-- 007-add-is-assignable-to-contacts.sql
-- Add is_assignable column to contacts table

ALTER TABLE contacts ADD COLUMN is_assignable BOOLEAN DEFAULT TRUE;
