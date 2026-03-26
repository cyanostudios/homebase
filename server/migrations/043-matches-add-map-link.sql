-- 043-matches-add-map-link.sql
-- Add optional map link for match location

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS map_link VARCHAR(500);

