-- 118-tasks-add-team-id.sql
-- Optional assigned team on tasks (when teams plugin is used)

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
