-- Add mail and inspection plugin access for existing tenants
-- Run this on the MAIN database (not tenant DBs)
-- Usage: psql $DATABASE_URL -f scripts/db/manual/add-mail-inspection-plugin-access.sql

INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
SELECT t.id, 'mail', true, t.owner_user_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_plugin_access tpa
  WHERE tpa.tenant_id = t.id AND tpa.plugin_name = 'mail'
);

INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
SELECT t.id, 'inspection', true, t.owner_user_id
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.tenant_plugin_access tpa
  WHERE tpa.tenant_id = t.id AND tpa.plugin_name = 'inspection'
);
