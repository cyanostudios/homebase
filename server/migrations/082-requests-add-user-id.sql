-- 082-requests-add-user-id.sql
-- PostgreSQLAdapter adds user_id to all inserts; requests table must have this column.

ALTER TABLE requests ADD COLUMN IF NOT EXISTS user_id INTEGER;
UPDATE requests SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE requests ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
