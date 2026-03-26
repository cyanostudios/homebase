-- 040-matches-add-match-number.sql
-- Add optional match number that user can set in UI

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS match_number INT;

CREATE INDEX IF NOT EXISTS idx_matches_user_match_number ON matches(user_id, match_number);

