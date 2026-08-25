-- 146-teams-player-count-history.sql
-- Append-only player count snapshots for Teams statistics "Players over time".

ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS player_count_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Seed one point at created_at with current player_count when history is empty.
UPDATE teams
SET player_count_history = jsonb_build_array(
  jsonb_build_object(
    'at', COALESCE(to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    'count', COALESCE(player_count, 0)
  )
)
WHERE player_count_history IS NULL
   OR player_count_history = '[]'::jsonb
   OR jsonb_typeof(player_count_history) <> 'array'
   OR jsonb_array_length(player_count_history) = 0;
