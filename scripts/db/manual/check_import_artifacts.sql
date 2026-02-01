-- Lists leftover tables that contain "import" in their names.
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_type = 'BASE TABLE'
  AND table_schema NOT IN ('pg_catalog','information_schema')
  AND table_name ILIKE '%import%';
