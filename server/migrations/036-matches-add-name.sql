-- 036-matches-add-name.sql
-- Add optional match name (defaults to "Home – Away" when blank in API/model)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS name VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_matches_name ON matches(name);

