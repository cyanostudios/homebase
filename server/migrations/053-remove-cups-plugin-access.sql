-- 053-remove-cups-plugin-access.sql
-- MAIN_DB_ONLY
-- Remove cups plugin rows from main application database access tables.
-- Skipped for per-tenant schema migrations (see LocalTenantProvider).
-- Uses existence checks so Neon/new DBs without these tables do not fail.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_plugin_access'
  ) THEN
    DELETE FROM user_plugin_access WHERE plugin_name = 'cups';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_plugin_access'
  ) THEN
    DELETE FROM tenant_plugin_access WHERE plugin_name = 'cups';
  END IF;
END $$;
