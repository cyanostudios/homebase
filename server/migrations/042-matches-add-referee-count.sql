-- 042-matches-add-referee-count.sql
-- Add referee count (default 1)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS referee_count INT DEFAULT 1;

UPDATE matches
  SET referee_count = 1
  WHERE referee_count IS NULL;

ALTER TABLE matches
  ALTER COLUMN referee_count SET DEFAULT 1;

ALTER TABLE matches
  ALTER COLUMN referee_count SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_user_referee_count ON matches(user_id, referee_count);

