-- 065-manufacturers-import-manufacturer-id.sql
-- Import matching: import_manufacturer_id for Sello manufacturer id+name linkage during import.

ALTER TABLE manufacturers ADD COLUMN IF NOT EXISTS import_manufacturer_id VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS ux_manufacturers_user_import_manufacturer_id
  ON manufacturers(user_id, import_manufacturer_id) WHERE import_manufacturer_id IS NOT NULL;
