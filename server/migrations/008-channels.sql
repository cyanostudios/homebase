-- 008-channels.sql
-- Channel product mapping table for managing product-channel relationships

CREATE TABLE IF NOT EXISTS channel_product_map (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  channel VARCHAR(255) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  last_sync_status VARCHAR(50) DEFAULT 'idle',
  last_synced_at TIMESTAMP,
  external_id VARCHAR(255),
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_channel_product_map_user_id ON channel_product_map(user_id);
CREATE INDEX idx_channel_product_map_channel ON channel_product_map(channel);
CREATE INDEX idx_channel_product_map_product_id ON channel_product_map(product_id);
CREATE INDEX idx_channel_product_map_user_channel ON channel_product_map(user_id, channel);

-- Unique constraint: one mapping per product-channel combination per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_map_user_product_channel 
  ON channel_product_map(user_id, product_id, channel);
