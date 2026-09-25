-- 173-clubdesk-price-list-price-override.sql
-- Optional free list price; NULL = follow inventory catalog price (sale → recommended) when linked.

ALTER TABLE clubdesk_price_list_items
  ADD COLUMN IF NOT EXISTS price_override NUMERIC(12, 2) NULL;

COMMENT ON COLUMN clubdesk_price_list_items.price_override IS
  'Optional list price. NULL means use inventory sale/recommended (or price column for free-text rows).';
