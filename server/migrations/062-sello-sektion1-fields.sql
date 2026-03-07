-- 062-sello-sektion1-fields.sql
-- Product fields: condition, group_id, volume, volume_unit, notes (lagerplats/weight exist).
-- List/brand import matching: import_folder_id, import_brand_id for id+name linkage during one-time import.

ALTER TABLE products ADD COLUMN IF NOT EXISTS condition VARCHAR(20) DEFAULT 'new';
ALTER TABLE products ADD COLUMN IF NOT EXISTS group_id VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS volume NUMERIC(12,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS volume_unit VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE lists ADD COLUMN IF NOT EXISTS import_folder_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lists_user_namespace_import_folder_id ON lists(user_id, namespace, import_folder_id) WHERE import_folder_id IS NOT NULL;

ALTER TABLE brands ADD COLUMN IF NOT EXISTS import_brand_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS ux_brands_user_import_brand_id ON brands(user_id, import_brand_id) WHERE import_brand_id IS NOT NULL;
