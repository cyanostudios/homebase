-- Lists columns for the contacts table (public schema)
SELECT
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.character_maximum_length,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public' AND c.table_name = 'contacts'
ORDER BY c.ordinal_position;
