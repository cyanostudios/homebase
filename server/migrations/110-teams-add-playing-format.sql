-- 110-teams-add-playing-format.sql
-- Playing format (Spelform): 3v3, 5v5, 7v7, 9v9, 11v11

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS playing_format VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_teams_playing_format ON teams(playing_format);
