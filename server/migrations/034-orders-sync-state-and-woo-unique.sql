-- 034-orders-sync-state-and-woo-unique.sql
-- 1) Orders uniqueness including channel_instance_id (Woo multi-store)
-- 2) order_sync_state table for incremental sync + quick-sync skip

-- ----- Orders: unique per (user, channel, instance, channel_order_id) -----
DROP INDEX IF EXISTS ux_orders_user_channel_channel_order_id;

CREATE UNIQUE INDEX ux_orders_user_channel_instance_order
  ON orders (user_id, channel, COALESCE(channel_instance_id, 0), channel_order_id);

-- ----- order_sync_state: one row per (user_id, channel, channel_instance_id). Use 0 for single-instance channels (CDON/Fyndiq). -----
CREATE TABLE IF NOT EXISTS order_sync_state (
  user_id INT NOT NULL,
  channel VARCHAR(50) NOT NULL,
  channel_instance_id INT NOT NULL DEFAULT 0,
  last_cursor_placed_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_status VARCHAR(50),
  last_error TEXT,
  next_run_at TIMESTAMPTZ,
  running_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, channel, channel_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_order_sync_state_user_id ON order_sync_state (user_id);
CREATE INDEX IF NOT EXISTS idx_order_sync_state_next_run ON order_sync_state (next_run_at) WHERE next_run_at IS NOT NULL;

COMMENT ON TABLE order_sync_state IS 'Per (user, channel, instance) sync state for incremental order sync and quick-sync skip';
