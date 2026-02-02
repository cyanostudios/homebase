-- 009-woocommerce.sql
-- WooCommerce settings and error logging tables

-- WooCommerce settings table
CREATE TABLE IF NOT EXISTS woocommerce_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  store_url TEXT NOT NULL,
  consumer_key TEXT NOT NULL,
  consumer_secret TEXT NOT NULL,
  use_query_auth BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_woocommerce_settings_user_id ON woocommerce_settings(user_id);

-- Unique constraint: one settings record per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_woocommerce_settings_user_id 
  ON woocommerce_settings(user_id);

-- Channel error log table (for tracking sync errors)
CREATE TABLE IF NOT EXISTS channel_error_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  channel VARCHAR(255) NOT NULL,
  product_id VARCHAR(255),
  payload JSONB,
  response JSONB,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_channel_error_log_user_id ON channel_error_log(user_id);
CREATE INDEX idx_channel_error_log_channel ON channel_error_log(channel);
CREATE INDEX idx_channel_error_log_created_at ON channel_error_log(created_at);
