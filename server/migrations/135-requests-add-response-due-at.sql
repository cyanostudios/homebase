-- 135-requests-add-response-due-at.sql
-- SLA / svarsdatum for requests. Existing rows backfilled to created_at + 7 days.

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS response_due_at TIMESTAMPTZ;

UPDATE requests
SET response_due_at = created_at + INTERVAL '7 days'
WHERE response_due_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_requests_response_due_at ON requests (response_due_at);
