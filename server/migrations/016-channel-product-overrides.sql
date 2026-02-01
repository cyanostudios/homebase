-- 016-channel-product-overrides.sql
-- Per-channel/per-instance overrides (price, active, category).
-- Supports multiple markets or multiple channel accounts via `instance`.

CREATE TABLE IF NOT EXISTS channel_product_overrides (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  product_id VARCHAR(255) NOT NULL,
  channel VARCHAR(255) NOT NULL,
  instance VARCHAR(50) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT FALSE,
  price_amount NUMERIC(12,2),
  currency VARCHAR(10),
  vat_rate NUMERIC(5,2),
  category TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_user_id
  ON channel_product_overrides(user_id);

CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_product_id
  ON channel_product_overrides(product_id);

CREATE INDEX IF NOT EXISTS idx_channel_product_overrides_channel_instance
  ON channel_product_overrides(channel, instance);

CREATE UNIQUE INDEX IF NOT EXISTS ux_channel_product_overrides_user_product_channel_instance
  ON channel_product_overrides(user_id, product_id, channel, instance);

