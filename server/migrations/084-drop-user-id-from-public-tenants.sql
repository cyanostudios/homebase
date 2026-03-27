-- 084-drop-user-id-from-public-tenants.sql
-- Public schema only.
-- Removes the legacy tenants.user_id column now that owner_user_id is canonical.

DO $$
DECLARE
  constraint_name text;
  index_name text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tenants'
      AND column_name = 'user_id'
  ) THEN
    FOR constraint_name IN
      SELECT c.conname
      FROM pg_constraint c
      INNER JOIN pg_class tbl ON tbl.oid = c.conrelid
      INNER JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      INNER JOIN unnest(c.conkey) AS key(attnum) ON TRUE
      INNER JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = key.attnum
      WHERE ns.nspname = 'public'
        AND tbl.relname = 'tenants'
        AND a.attname = 'user_id'
    LOOP
      EXECUTE format(
        'ALTER TABLE public.tenants DROP CONSTRAINT IF EXISTS %I',
        constraint_name
      );
    END LOOP;

    FOR index_name IN
      SELECT idx.indexname
      FROM pg_indexes idx
      WHERE idx.schemaname = 'public'
        AND idx.tablename = 'tenants'
        AND idx.indexdef ILIKE '%user_id%'
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', index_name);
    END LOOP;

    ALTER TABLE public.tenants DROP COLUMN IF EXISTS user_id CASCADE;
  END IF;
END $$;
