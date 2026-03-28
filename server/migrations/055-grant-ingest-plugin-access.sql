-- 055-grant-ingest-plugin-access.sql
-- MAIN_DB_ONLY
-- Grant plugin "ingest" to all existing tenants and each tenant owner's user_plugin_access row.
-- Run against the main application database (same as 053). Per-tenant Neon schemas skip this file.
-- Idempotent: ON CONFLICT DO NOTHING.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_plugin_access'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) THEN
    INSERT INTO tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
    SELECT t.id, 'ingest', true, COALESCE(t.owner_user_id, t.user_id)
    FROM tenants t
    ON CONFLICT (tenant_id, plugin_name) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_plugin_access'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) THEN
    INSERT INTO user_plugin_access (user_id, plugin_name, enabled, granted_by)
    SELECT DISTINCT x.uid, 'ingest', true, x.uid
    FROM (
      SELECT COALESCE(owner_user_id, user_id) AS uid
      FROM tenants
    ) x
    WHERE x.uid IS NOT NULL
    ON CONFLICT (user_id, plugin_name) DO NOTHING;
  END IF;
END $$;
