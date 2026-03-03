-- Index hardening for analytics on normalized fields

CREATE INDEX IF NOT EXISTS idx_orders_user_placed_at_v2
  ON orders (user_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_status_placed_at_v2
  ON orders (user_id, status, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_channel_placed_at_v2
  ON orders (user_id, channel, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_channel_instance_placed_at_v2
  ON orders (user_id, channel_instance_id, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_channel_market_placed_at_v2
  ON orders (user_id, channel, channel_market_norm, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_customer_identifier_placed_at_v2
  ON orders (user_id, customer_identifier_norm, placed_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_first_orders_user_identifier
  ON customer_first_orders (user_id, customer_identifier_norm);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_v2
  ON order_items (order_id);
