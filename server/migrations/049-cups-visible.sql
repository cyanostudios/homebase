-- 049-cups-visible.sql
-- Add visibility flag for cups (detail + bulk controls in UI).

ALTER TABLE cups
ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;
