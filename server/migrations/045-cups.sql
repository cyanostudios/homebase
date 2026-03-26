-- 045-cups.sql
-- Main cups table: one row per scraped cup/tournament entry.

CREATE TABLE IF NOT EXISTS cups (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(500) NOT NULL,
  organizer       VARCHAR(255),
  region          VARCHAR(255),
  location        VARCHAR(255),
  sport_type      VARCHAR(100) NOT NULL DEFAULT 'football',
  start_date      DATE,
  end_date        DATE,
  age_groups      TEXT,
  registration_url VARCHAR(1000),
  source_url      VARCHAR(1000),
  source_id       INTEGER,
  raw_snippet     TEXT,
  scraped_at      TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cups_sport_type_idx ON cups (sport_type);
CREATE INDEX IF NOT EXISTS cups_start_date_idx ON cups (start_date);
CREATE INDEX IF NOT EXISTS cups_source_id_idx  ON cups (source_id);
