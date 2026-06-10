-- 078-teams-team-notes.sql
-- Multiple notes per team (JSONB array), migrate legacy status_note

ALTER TABLE teams ADD COLUMN IF NOT EXISTS team_notes JSONB DEFAULT '[]';

UPDATE teams
SET team_notes = jsonb_build_array(
  jsonb_build_object(
    'id', 'legacy-' || id::text,
    'text', status_note,
    'createdAt', COALESCE(updated_at, created_at, NOW())::text
  )
)
WHERE status_note IS NOT NULL
  AND trim(status_note) <> ''
  AND (
    team_notes IS NULL
    OR team_notes = '[]'::jsonb
    OR jsonb_array_length(team_notes) = 0
  );
