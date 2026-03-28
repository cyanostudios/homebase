-- 086-product-batch-sync-jobs.sql
-- Async batch product sync: job history (max 50 rows per tenant enforced in app), progress + errors.

CREATE TABLE IF NOT EXISTS product_batch_sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending',
  total_products INT NOT NULL DEFAULT 0,
  processed_db INT NOT NULL DEFAULT 0,
  processed_channels INT NOT NULL DEFAULT 0,
  product_ids TEXT[] NOT NULL DEFAULT '{}',
  changes JSONB NOT NULL DEFAULT '{}',
  errors JSONB NOT NULL DEFAULT '[]',
  created_by_user_id TEXT,
  trigger_source TEXT NOT NULL DEFAULT 'batch',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS product_batch_sync_jobs_created_at_idx
  ON product_batch_sync_jobs (created_at DESC);
