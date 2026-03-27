-- 082-drop-user-id-from-core-tenant-tables.sql
-- Tenant schemas only.
-- Removes legacy user_id scoping from tables that are now isolated purely by tenant schema/database.

DO $$
DECLARE
  v_table_name text;
  constraint_name text;
  index_name text;
BEGIN
  FOREACH v_table_name IN ARRAY ARRAY[
    'contacts',
    'contact_time_entries',
    'notes',
    'tasks',
    'user_files',
    'file_list_items',
    'lists',
    'contact_list_items',
    'mail_log',
    'mail_settings'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = v_table_name
        AND column_name = 'user_id'
    ) THEN
      FOR constraint_name IN
        SELECT c.conname
        FROM pg_constraint c
        INNER JOIN pg_class tbl ON tbl.oid = c.conrelid
        INNER JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        INNER JOIN unnest(c.conkey) AS key(attnum) ON TRUE
        INNER JOIN pg_attribute a ON a.attrelid = tbl.oid AND a.attnum = key.attnum
        WHERE ns.nspname = current_schema()
          AND tbl.relname = v_table_name
          AND a.attname = 'user_id'
      LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I', current_schema(), v_table_name, constraint_name);
      END LOOP;

      FOR index_name IN
        SELECT idx.indexname
        FROM pg_indexes idx
        WHERE idx.schemaname = current_schema()
          AND idx.tablename = v_table_name
          AND idx.indexdef ILIKE '%user_id%'
      LOOP
        EXECUTE format('DROP INDEX IF EXISTS %I.%I', current_schema(), index_name);
      END LOOP;

      EXECUTE format('ALTER TABLE %I.%I DROP COLUMN IF EXISTS user_id', current_schema(), v_table_name);
    END IF;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lists_namespace_name_unique
  ON lists(namespace, name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_list_items_list_file_unique
  ON file_list_items(list_id, file_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contact_list_items_list_contact_unique
  ON contact_list_items(list_id, contact_id);
