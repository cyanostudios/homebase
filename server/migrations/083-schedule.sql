-- 083-schedule.sql
-- Creates schedules and schedule_events tables for the Schedule plugin (tenant DB)

CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  is_team_calendar BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_team_calendar
  ON schedules (is_team_calendar)
  WHERE is_team_calendar = true;

CREATE TABLE IF NOT EXISTS schedule_events (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'recurring',
  day TEXT,
  event_date DATE,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_user_id ON schedule_events(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_schedule_id ON schedule_events(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_event_date ON schedule_events(event_date);
