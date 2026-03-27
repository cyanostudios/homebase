-- 050-cups-sanctioned.sql
-- Add sanctioned flag for cups (default off).

ALTER TABLE cups
ADD COLUMN IF NOT EXISTS sanctioned BOOLEAN NOT NULL DEFAULT FALSE;
