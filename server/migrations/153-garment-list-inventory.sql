-- 153-garment-list-inventory.sql
-- Link inventory items to garment lists; store per-person size picks per item.

CREATE TABLE IF NOT EXISTS garment_list_inventory_items (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES garment_lists(id) ON DELETE CASCADE,
  item_id INTEGER NOT NULL REFERENCES garment_inventory_items(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (list_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_garment_list_inventory_items_list
  ON garment_list_inventory_items(list_id);

CREATE INDEX IF NOT EXISTS idx_garment_list_inventory_items_item
  ON garment_list_inventory_items(item_id);

ALTER TABLE garment_list_persons
  ADD COLUMN IF NOT EXISTS ct_sizes JSONB NOT NULL DEFAULT '{}'::jsonb;
