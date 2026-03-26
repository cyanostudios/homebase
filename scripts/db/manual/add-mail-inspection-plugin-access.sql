-- Add mail and inspection plugin access for existing users
-- Run this on the MAIN database (not tenant DBs)
-- Usage: psql $DATABASE_URL -f scripts/db/manual/add-mail-inspection-plugin-access.sql

INSERT INTO public.user_plugin_access (user_id, plugin_name, enabled)
SELECT u.id, 'mail', true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_plugin_access upa
  WHERE upa.user_id = u.id AND upa.plugin_name = 'mail'
);

INSERT INTO public.user_plugin_access (user_id, plugin_name, enabled)
SELECT u.id, 'inspection', true
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_plugin_access upa
  WHERE upa.user_id = u.id AND upa.plugin_name = 'inspection'
);
