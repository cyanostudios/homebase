-- 155-garment-list-persons-team-id.sql
-- Optional team link per person on a garment list.

ALTER TABLE garment_list_persons
  ADD COLUMN IF NOT EXISTS team_id INTEGER NULL REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_garment_list_persons_team
  ON garment_list_persons(team_id)
  WHERE team_id IS NOT NULL;
