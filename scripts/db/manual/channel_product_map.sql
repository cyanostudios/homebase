CREATE TABLE IF NOT EXISTS channel_product_map (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_status TEXT DEFAULT 'idle',
  last_synced_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_cpm_user_channel ON channel_product_map(user_id, channel);
