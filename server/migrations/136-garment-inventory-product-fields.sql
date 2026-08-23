-- 136-garment-inventory-product-fields.sql
-- Extend inventory items with product fields (sku, color, description, material, purchase price).
-- Unique key becomes (user_id, article_name, brand, color, size) so same name+brand can exist in multiple color/size rows.

ALTER TABLE garment_inventory_items
  ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS material TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'SEK';

DROP INDEX IF EXISTS idx_garment_inventory_unique_article;

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_inventory_unique_article
  ON garment_inventory_items (
    user_id,
    lower(article_name),
    lower(brand),
    lower(color),
    lower(size)
  );
