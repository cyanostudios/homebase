-- 185-site-audits.sql
-- Tenant DB: Site audits plugin (sites + audit runs)

CREATE TABLE IF NOT EXISTS site_audits (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  competitor_url TEXT,
  last_score INTEGER,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_audits_user_id ON site_audits (user_id);
CREATE INDEX IF NOT EXISTS idx_site_audits_updated_at ON site_audits (updated_at DESC);

CREATE TABLE IF NOT EXISTS site_audit_runs (
  id SERIAL PRIMARY KEY,
  site_audit_id INTEGER NOT NULL REFERENCES site_audits(id) ON DELETE CASCADE,
  target VARCHAR(20) NOT NULL DEFAULT 'site'
    CHECK (target IN ('site', 'competitor')),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'done', 'failed')),
  score INTEGER,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  pages JSONB NOT NULL DEFAULT '[]'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_site_audit_runs_site_started
  ON site_audit_runs (site_audit_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_site_audit_runs_status
  ON site_audit_runs (status);
