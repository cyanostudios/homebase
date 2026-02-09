-- 039-fix-inspection-project-files-sequence.sql
-- Fix SERIAL sequence for inspection_project_files (can be out of sync after data copy/migration).

SELECT setval(
  pg_get_serial_sequence('inspection_project_files', 'id'),
  COALESCE((SELECT MAX(id) FROM inspection_project_files), 1)
);
