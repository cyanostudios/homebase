-- 098-guide-production-jobs.sql
-- Content Production Pipeline P7: ProductionJob domain

CREATE TABLE IF NOT EXISTS guide_production_jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  place_id INTEGER NOT NULL REFERENCES guide_places(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  scope_stop_id INTEGER REFERENCES guide_stops(id) ON DELETE SET NULL,
  scope_variant_id INTEGER REFERENCES guide_variant_presentations(id) ON DELETE SET NULL,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_production_jobs_place_id ON guide_production_jobs(place_id);
CREATE INDEX IF NOT EXISTS idx_guide_production_jobs_status ON guide_production_jobs(status);
CREATE INDEX IF NOT EXISTS idx_guide_production_jobs_place_created
  ON guide_production_jobs(place_id, created_at DESC);

CREATE TABLE IF NOT EXISTS guide_production_job_items (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES guide_production_jobs(id) ON DELETE CASCADE,
  stop_id INTEGER NOT NULL REFERENCES guide_stops(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES guide_variant_presentations(id) ON DELETE CASCADE,
  step VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  fingerprint VARCHAR(64) NOT NULL,
  provider_key VARCHAR(50) NOT NULL,
  provider_result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_production_job_items_job_id ON guide_production_job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_guide_production_job_items_fingerprint
  ON guide_production_job_items(fingerprint, status);

CREATE TABLE IF NOT EXISTS guide_production_job_events (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES guide_production_jobs(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES guide_production_job_items(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_production_job_events_job_id ON guide_production_job_events(job_id);
