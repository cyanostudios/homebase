-- Deferred media phase for product duplicate jobs + per-pair media tasks.

ALTER TABLE product_duplicate_jobs
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'products',
  ADD COLUMN IF NOT EXISTS products_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS media_total INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_processed INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_error_count INT NOT NULL DEFAULT 0;

UPDATE product_duplicate_jobs
SET phase = 'done'
WHERE status IN ('completed', 'failed');

CREATE TABLE IF NOT EXISTS product_duplicate_media_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES product_duplicate_jobs (id) ON DELETE CASCADE,
  source_product_id INT NOT NULL,
  dest_product_id INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  last_error TEXT,
  started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  CONSTRAINT product_duplicate_media_tasks_status_chk
    CHECK (status IN ('queued', 'running', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS product_duplicate_media_tasks_job_id_idx
  ON product_duplicate_media_tasks (job_id);

CREATE INDEX IF NOT EXISTS product_duplicate_media_tasks_source_status_idx
  ON product_duplicate_media_tasks (source_product_id, status);

CREATE INDEX IF NOT EXISTS product_duplicate_media_tasks_dest_status_idx
  ON product_duplicate_media_tasks (dest_product_id, status);
