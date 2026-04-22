-- Async product duplicate jobs (batch copy with optional media).

CREATE TABLE IF NOT EXISTS product_duplicate_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued',
  total_products INT NOT NULL DEFAULT 0,
  processed_products INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS product_duplicate_jobs_created_at_idx
  ON product_duplicate_jobs (created_at DESC);
