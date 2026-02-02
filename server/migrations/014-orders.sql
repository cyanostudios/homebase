-- 014-orders.sql
-- Orders + order line items (aggregated from channels)

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  channel_order_id VARCHAR(255) NOT NULL,
  platform_order_number VARCHAR(100),
  placed_at TIMESTAMP,
  total_amount NUMERIC(12, 2),
  currency VARCHAR(10) DEFAULT 'SEK',
  status VARCHAR(50) DEFAULT 'processing',
  shipping_address JSONB,
  billing_address JSONB,
  customer JSONB,
  shipping_carrier VARCHAR(255),
  shipping_tracking_number VARCHAR(255),
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Idempotency / dedupe: one channel order per user/channel
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_user_channel_channel_order_id
  ON orders(user_id, channel, channel_order_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON orders(placed_at);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku VARCHAR(255),
  product_id INT,
  title VARCHAR(255),
  quantity INT NOT NULL DEFAULT 0,
  unit_price NUMERIC(12, 2),
  vat_rate NUMERIC(5, 2),
  raw JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
