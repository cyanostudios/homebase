-- 134-teams-venues.sql
-- Tenant DB (local-only apply): shared venue catalog + optional schedule_events.venue_id (no FK)

CREATE TABLE IF NOT EXISTS team_venues (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  map_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_venues_user_lower_name
  ON team_venues (user_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_team_venues_user_id ON team_venues (user_id);

ALTER TABLE IF EXISTS schedule_events
  ADD COLUMN IF NOT EXISTS venue_id INT NULL;
