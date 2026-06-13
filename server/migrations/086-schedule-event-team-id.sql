-- Link schedule events to teams for color-coding in plan views (does not modify team data)
ALTER TABLE schedule_events
  ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_events_team_id ON schedule_events(team_id);
