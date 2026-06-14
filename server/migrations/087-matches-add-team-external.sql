-- 087-matches-add-team-external.sql
-- Link matches to teams and support external API sync

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS team_id INT REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_source VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_matches_external_id
  ON matches(user_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matches_team_id ON matches(team_id);
