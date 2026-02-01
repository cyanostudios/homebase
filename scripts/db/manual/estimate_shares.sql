CREATE TABLE IF NOT EXISTS estimate_shares (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  valid_until TIMESTAMP NOT NULL,
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_shares_estimate ON estimate_shares(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_shares_valid_until ON estimate_shares(valid_until);
