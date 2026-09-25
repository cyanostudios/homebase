-- 172-clubdesk-price-list-inventory-link.sql
-- Tenant DB: optional inventory FK on Clubdesk price list items (Epic 2).
-- Free-text rows keep both FKs NULL. ON DELETE SET NULL preserves price row text/price.

ALTER TABLE clubdesk_price_list_items
  ADD COLUMN IF NOT EXISTS inventory_item_id INTEGER
    REFERENCES clubdesk_inventory_items(id) ON DELETE SET NULL;

ALTER TABLE clubdesk_price_list_items
  ADD COLUMN IF NOT EXISTS inventory_variant_id INTEGER
    REFERENCES clubdesk_inventory_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clubdesk_pli_inventory_item
  ON clubdesk_price_list_items (inventory_item_id)
  WHERE inventory_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clubdesk_pli_inventory_variant
  ON clubdesk_price_list_items (inventory_variant_id)
  WHERE inventory_variant_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE clubdesk_price_list_items
    ADD CONSTRAINT clubdesk_pli_variant_requires_item
    CHECK (inventory_variant_id IS NULL OR inventory_item_id IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
