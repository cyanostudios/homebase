-- 137-garment-inventory-variants.sql
-- Parent item + child variants: product fields on item; sku/color/size/quantity on variants.
-- Local testdata may be wiped (TRUNCATE). No production data migration.

-- Wipe existing flat inventory rows (testdata OK to reset).
TRUNCATE TABLE garment_inventory_items RESTART IDENTITY CASCADE;

CREATE TABLE IF NOT EXISTS garment_inventory_variants (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES garment_inventory_items(id) ON DELETE CASCADE,
  sku TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_garment_inventory_variants_item
  ON garment_inventory_variants(item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_inventory_variants_unique
  ON garment_inventory_variants (item_id, lower(color), lower(size));

-- Drop flat variant columns from items (if present from 131/136).
ALTER TABLE garment_inventory_items
  DROP COLUMN IF EXISTS sku,
  DROP COLUMN IF EXISTS color,
  DROP COLUMN IF EXISTS size,
  DROP COLUMN IF EXISTS quantity;

-- Item uniqueness: one product per (user, name, brand).
DROP INDEX IF EXISTS idx_garment_inventory_unique_article;

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_inventory_unique_article
  ON garment_inventory_items (
    user_id,
    lower(article_name),
    lower(brand)
  );
