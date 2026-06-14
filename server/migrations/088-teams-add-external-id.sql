-- 088-teams-add-external-id.sql
-- External team ID for match API import (e.g. FOGIS lagId)

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS external_team_id VARCHAR(100);
