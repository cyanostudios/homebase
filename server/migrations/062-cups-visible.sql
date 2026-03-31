-- 062-cups-visible.sql
-- Visibility flag for public cups listing.

ALTER TABLE cups
ADD COLUMN IF NOT EXISTS visible BOOLEAN NOT NULL DEFAULT TRUE;
