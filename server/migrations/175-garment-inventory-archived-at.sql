-- 175-garment-inventory-archived-at.sql
-- Archive is a timestamp, not a hard delete. Active articles stay unique on
-- (user, name, brand). Archived rows may share that key so a replacement
-- article can be created while history keeps the old id.

ALTER TABLE garment_inventory_items
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

-- Replace the full unique index. CREATE INDEX IF NOT EXISTS would keep the
-- old index (no WHERE) and the partial index would never be created.
DROP INDEX IF EXISTS idx_garment_inventory_unique_article;

CREATE UNIQUE INDEX idx_garment_inventory_unique_article
  ON garment_inventory_items (
    user_id,
    lower(article_name),
    lower(brand)
  )
  WHERE archived_at IS NULL;
