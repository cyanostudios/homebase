-- 080-requests.sql
-- Creates the requests table for the Requests plugin (tenant DB)

CREATE TABLE IF NOT EXISTS requests (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  request_type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'not started',
  priority TEXT NOT NULL DEFAULT 'Medium',
  team_id INTEGER,
  submitter_name TEXT,
  submitter_email TEXT,
  contact_id INTEGER,
  assigned_to_ids JSONB DEFAULT '[]',
  internal_notes TEXT,
  source TEXT DEFAULT 'internal',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requests_team_id ON requests(team_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_source ON requests(source);
