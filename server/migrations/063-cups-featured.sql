-- 063-cups-featured.sql
-- Featured flag for promoted cups in public listing (default off).

ALTER TABLE cups
ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
