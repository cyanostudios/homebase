-- Sello API product history (/v5/products/{id}/history) stored at import for stats timeline.

CREATE TABLE IF NOT EXISTS product_selio_import_history (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(255) NOT NULL,
  event_at TIMESTAMPTZ NOT NULL,
  event_kind VARCHAR(32) NOT NULL,
  channel_label VARCHAR(255),
  order_ref VARCHAR(255),
  sale_quantity INT,
  new_quantity INT,
  sello_code INT NOT NULL,
  message TEXT,
  params JSONB
);

CREATE INDEX IF NOT EXISTS idx_product_selio_import_history_product_event
  ON product_selio_import_history (product_id, event_at DESC);
