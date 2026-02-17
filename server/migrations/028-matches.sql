-- 028-matches.sql
-- Sport matches: home/away team, location, start time, sport type, format, total minutes

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  sport_type VARCHAR(50) NOT NULL,
  format VARCHAR(20) NOT NULL,
  total_minutes INT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_start_time ON matches(start_time);
CREATE INDEX IF NOT EXISTS idx_matches_sport_type ON matches(sport_type);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at);
