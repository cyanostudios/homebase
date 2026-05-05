-- 073-cup-ratings.sql
-- Ratings and review comments for public cup detail pages.

CREATE TABLE IF NOT EXISTS cup_ratings (
  id SERIAL PRIMARY KEY,
  cup_id INTEGER NOT NULL REFERENCES cups(id) ON DELETE CASCADE,
  reviewer_name VARCHAR(100) NOT NULL,
  reviewer_role VARCHAR(100),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cup_ratings_cup_id ON cup_ratings(cup_id);
