-- Per-tenant schema: audit trail for product on-hand quantity changes (stats timeline).

CREATE TABLE IF NOT EXISTS product_stock_events (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  previous_quantity INT,
  new_quantity INT NOT NULL,
  source VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_stock_events_product_created
  ON product_stock_events (product_id, created_at DESC);
