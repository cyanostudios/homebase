-- 156-garment-inventory-tags.sql
-- Tags on inventory articles (Contacts-style multi-tag JSONB)

ALTER TABLE garment_inventory_items
ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;
