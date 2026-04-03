-- 088-product-import-jobs.sql
-- Async CSV/XLSX product import: job history (max 5 rows per tenant in app), progress, file path for re-download.

CREATE TABLE IF NOT EXISTS product_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'queued',
  mode TEXT NOT NULL,
  match_key TEXT NOT NULL DEFAULT 'sku',
  original_filename TEXT NOT NULL DEFAULT '',
  mime_type TEXT,
  storage_path TEXT NOT NULL DEFAULT '',
  total_rows INT NOT NULL DEFAULT 0,
  processed_rows INT NOT NULL DEFAULT 0,
  created_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  skipped_missing_key INT NOT NULL DEFAULT 0,
  skipped_invalid INT NOT NULL DEFAULT 0,
  conflicts_count INT NOT NULL DEFAULT 0,
  not_found_count INT NOT NULL DEFAULT 0,
  detected_headers JSONB NOT NULL DEFAULT '[]',
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS product_import_jobs_created_at_idx
  ON product_import_jobs (created_at DESC);
