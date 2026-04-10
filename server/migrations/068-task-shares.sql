-- Public share links for tasks (same pattern as note_shares)
CREATE TABLE IF NOT EXISTS task_shares (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  valid_until TIMESTAMP NOT NULL,
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_shares_task ON task_shares(task_id);
CREATE INDEX IF NOT EXISTS idx_task_shares_valid_until ON task_shares(valid_until);
CREATE INDEX IF NOT EXISTS idx_task_shares_token ON task_shares(share_token);
