-- 041-matches-add-match-type.sql
-- Add optional match type (series, cup, friendly)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS match_type VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_matches_user_match_type ON matches(user_id, match_type);

