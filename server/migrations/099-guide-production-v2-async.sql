-- 099-guide-production-v2-async.sql
-- Content Production Pipeline v2 P-ASYNC: async worker schema

ALTER TABLE guide_production_jobs
  ADD COLUMN IF NOT EXISTS phases JSONB NOT NULL DEFAULT '["text_derivation"]',
  ADD COLUMN IF NOT EXISTS current_phase_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS checkpoint_mode VARCHAR(50) NOT NULL DEFAULT 'after_text',
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_phase VARCHAR(50),
  ADD COLUMN IF NOT EXISTS job_options JSONB;

ALTER TABLE guide_production_job_items
  ADD COLUMN IF NOT EXISTS user_id INTEGER,
  ADD COLUMN IF NOT EXISTS phase_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS provider_version VARCHAR(50) NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS review_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_claimed_at TIMESTAMPTZ;

UPDATE guide_production_job_items i
SET user_id = j.user_id
FROM guide_production_jobs j
WHERE i.job_id = j.id
  AND i.user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_guide_production_job_items_pending_worker
  ON guide_production_job_items (status, retry_after)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_guide_production_jobs_pending_queue
  ON guide_production_jobs (status, priority DESC, queued_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS guide_production_workers (
  id SERIAL PRIMARY KEY,
  worker_id VARCHAR(255) UNIQUE NOT NULL,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items_processing INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
