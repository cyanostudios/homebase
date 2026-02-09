-- 019-woocommerce-settings-columns.sql
-- Normalize woocommerce_settings to match model (store_url, use_query_auth).
-- Fixes tables created from manual script (site_url) or older schema.
-- Uses current_schema() so it works with tenant schemas (search_path).

DO $$
BEGIN
  -- Rename site_url -> store_url if manual/legacy schema
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'woocommerce_settings' AND column_name = 'site_url'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'woocommerce_settings' AND column_name = 'store_url'
  ) THEN
    ALTER TABLE woocommerce_settings RENAME COLUMN site_url TO store_url;
  END IF;

  -- Add use_query_auth if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'woocommerce_settings' AND column_name = 'use_query_auth'
  ) THEN
    ALTER TABLE woocommerce_settings ADD COLUMN use_query_auth BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
