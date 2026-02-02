-- 018-fix-channel-error-log.sql
-- Fix channel_error_log table: ensure created_at column exists

ALTER TABLE channel_error_log
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

-- If created_at was NULL for existing rows, set it to NOW()
UPDATE channel_error_log
SET created_at = NOW()
WHERE created_at IS NULL;

-- Ensure index exists
CREATE INDEX IF NOT EXISTS idx_channel_error_log_created_at 
  ON channel_error_log(created_at);
