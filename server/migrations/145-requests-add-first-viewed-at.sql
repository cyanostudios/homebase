-- 145-requests-add-first-viewed-at.sql
-- Track when a request was first opened by any staff member (tenant-wide "new" indicator).

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_requests_first_viewed_at ON requests(first_viewed_at);
