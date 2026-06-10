-- 076-teams.sql
-- Teams (Lag & Teams): association teams with schedules, season breaks, and responsibles linked to contacts

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  age_group VARCHAR(50),
  gender VARCHAR(20),
  player_count INT DEFAULT 0,
  series_team_count INT DEFAULT 0,
  series_teams JSONB DEFAULT '[]',
  status VARCHAR(20) DEFAULT 'active',
  status_note TEXT,
  team_notes JSONB DEFAULT '[]',
  training_times JSONB DEFAULT '[]',
  season_breaks JSONB DEFAULT '[]',
  responsibles JSONB DEFAULT '[]',
  color VARCHAR(20) DEFAULT 'green',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status);
CREATE INDEX IF NOT EXISTS idx_teams_age_group ON teams(age_group);
CREATE INDEX IF NOT EXISTS idx_teams_created_at ON teams(created_at);
