-- 127-clubdesk-featured.sql
-- Featured flag for guides and price lists shown as home square cards (default off).

ALTER TABLE clubdesk_guides
ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE clubdesk_price_lists
ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT FALSE;
