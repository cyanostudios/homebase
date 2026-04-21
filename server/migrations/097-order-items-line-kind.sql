-- 097-order-items-line-kind.sql
-- Discriminate WooCommerce shipping_lines vs product line_items in order_items for reporting and list counts.

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS line_kind VARCHAR(20) NOT NULL DEFAULT 'product';

COMMENT ON COLUMN order_items.line_kind IS 'product | shipping | fee | other — shipping from WC shipping_lines, fee optional';
