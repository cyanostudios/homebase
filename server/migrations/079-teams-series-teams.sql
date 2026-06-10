-- 079-teams-series-teams.sql
-- Named series teams per association team; migrate from series_team_count

ALTER TABLE teams ADD COLUMN IF NOT EXISTS series_teams JSONB DEFAULT '[]';

UPDATE teams
SET series_teams = (
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('name', 'Serielag ' || i) ORDER BY i),
    '[]'::jsonb
  )
  FROM generate_series(1, series_team_count) AS i
)
WHERE series_team_count > 0
  AND (
    series_teams IS NULL
    OR series_teams = '[]'::jsonb
    OR jsonb_array_length(series_teams) = 0
  );
