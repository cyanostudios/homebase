-- 054-ingest-sources-and-runs.sql
-- Ingest plugin: external sources and import run history (tenant DB).

CREATE TABLE IF NOT EXISTS ingest_sources (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  source_url VARCHAR(2000) NOT NULL,
  source_type VARCHAR(20) NOT NULL,
  fetch_method VARCHAR(50) NOT NULL DEFAULT 'generic_http',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  last_fetched_at TIMESTAMP,
  last_fetch_status VARCHAR(20) NOT NULL DEFAULT 'never',
  last_fetch_error TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingest_sources_user_id_idx ON ingest_sources (user_id);

CREATE TABLE IF NOT EXISTS ingest_runs (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  source_id INT NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  http_status INT,
  content_type VARCHAR(255),
  content_length INT,
  raw_excerpt TEXT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ingest_runs_source_id_idx ON ingest_runs (source_id);
CREATE INDEX IF NOT EXISTS ingest_runs_source_started_idx ON ingest_runs (source_id, started_at DESC);
