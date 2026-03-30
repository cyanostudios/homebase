-- 058-cups-v1.sql
-- Cups domain table (v1)

CREATE TABLE IF NOT EXISTS cups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  organizer VARCHAR(255),
  location VARCHAR(255),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  categories TEXT,
  description TEXT,
  registration_url TEXT,
  source_url TEXT,
  source_type VARCHAR(50),
  ingest_source_id INTEGER,
  ingest_run_id INTEGER,
  external_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  user_id INTEGER NOT NULL
);

ALTER TABLE cups ADD COLUMN IF NOT EXISTS organizer VARCHAR(255);
ALTER TABLE cups ADD COLUMN IF NOT EXISTS location VARCHAR(255);
ALTER TABLE cups ADD COLUMN IF NOT EXISTS start_date TIMESTAMP;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS end_date TIMESTAMP;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS categories TEXT;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS registration_url TEXT;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS source_type VARCHAR(50);
ALTER TABLE cups ADD COLUMN IF NOT EXISTS ingest_source_id INTEGER;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS ingest_run_id INTEGER;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
ALTER TABLE cups ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE cups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_cups_user_id ON cups(user_id);
CREATE INDEX IF NOT EXISTS idx_cups_start_date ON cups(start_date);
CREATE INDEX IF NOT EXISTS idx_cups_ingest_source_id ON cups(ingest_source_id);

