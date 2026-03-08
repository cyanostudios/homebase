-- 068-products-sello-stats.sql
-- Sello-sourced stats: created date, quantity sold, last sold (from Sello API product payload).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS source_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quantity_sold INT,
  ADD COLUMN IF NOT EXISTS last_sold_at TIMESTAMPTZ;

COMMENT ON COLUMN products.source_created_at IS 'When the product was created in the source (e.g. Sello created_at)';
COMMENT ON COLUMN products.quantity_sold IS 'Total quantity sold from source (e.g. Sello sold)';
COMMENT ON COLUMN products.last_sold_at IS 'When the product was last sold (e.g. Sello last_sold)';
