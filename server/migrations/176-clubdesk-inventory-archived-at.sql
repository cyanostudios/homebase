-- 176-clubdesk-inventory-archived-at.sql
-- Tenant DB: archive Clubdesk inventory without dropping price-list history.
-- Active name+brand and slug stay unique. Several archived rows may share them.

ALTER TABLE clubdesk_inventory_items
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

DROP INDEX IF EXISTS idx_clubdesk_inventory_items_user_article_brand;
CREATE UNIQUE INDEX idx_clubdesk_inventory_items_user_article_brand
  ON clubdesk_inventory_items (user_id, lower(article_name), lower(brand))
  WHERE archived_at IS NULL;

DROP INDEX IF EXISTS idx_clubdesk_inventory_items_user_lower_slug;
CREATE UNIQUE INDEX idx_clubdesk_inventory_items_user_lower_slug
  ON clubdesk_inventory_items (user_id, lower(slug))
  WHERE archived_at IS NULL;
