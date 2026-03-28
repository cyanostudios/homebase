-- 052-drop-cups-tables.sql
-- Tear down cups plugin tables on tenant data databases (cups references cup_sources via source_id).
-- After this, run 053-remove-cups-plugin-access.sql (or npm run migrate:remove-cups-plugin-access)
-- on the main application database to delete plugin_name = 'cups' from access tables.

DROP TABLE IF EXISTS cups CASCADE;
DROP TABLE IF EXISTS cup_sources CASCADE;
