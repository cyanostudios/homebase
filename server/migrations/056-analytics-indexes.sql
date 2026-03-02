-- Analytics performance indexes for common filters/aggregations

CREATE INDEX IF NOT EXISTS idx_orders_user_placed_at
  ON orders (user_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_channel_instance_placed_at
  ON orders (user_id, channel, channel_instance_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_status_placed_at
  ON orders (user_id, status, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_sku
  ON order_items (order_id, sku);
