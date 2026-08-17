-- 133-public-share-routing-garment-list.sql
-- MAIN_DB_ONLY
-- Widen public_share_routing.resource_type CHECK to include garment_list
-- (and align with types already used in code: estimate, invoice).

DO $$
DECLARE
  constraint_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'public_share_routing'
  ) THEN
    RETURN;
  END IF;

  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'public_share_routing'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%resource_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public_share_routing DROP CONSTRAINT %I', constraint_name);
  END IF;

  ALTER TABLE public_share_routing
    ADD CONSTRAINT public_share_routing_resource_type_check
    CHECK (resource_type IN ('task', 'note', 'estimate', 'invoice', 'garment_list'));
END $$;
