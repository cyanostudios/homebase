-- 179-clubdesk-inventory-kiosk-catalog.sql
-- Tenant DB: kiosk master catalog flat columns on clubdesk_inventory_items (Clubdesk only).

ALTER TABLE clubdesk_inventory_items
  ADD COLUMN IF NOT EXISTS catalog_key TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS package_size TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS package_unit TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gtin TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS article_number TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ingredients TEXT,
  ADD COLUMN IF NOT EXISTS allergens TEXT,
  ADD COLUMN IF NOT EXISTS energy_kcal_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fat_g_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS saturated_fat_g_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS carbohydrate_g_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS sugar_g_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS protein_g_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS salt_g_100g NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS net_content TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_of_origin TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_of_manufacture TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS supplier TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS catalog_source TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS verified_at DATE,
  ADD COLUMN IF NOT EXISTS data_status TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_user_catalog_key
  ON clubdesk_inventory_items (user_id, catalog_key)
  WHERE catalog_key IS NOT NULL AND catalog_key <> '';
