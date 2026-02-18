-- 032-rename-kiosk-plugin-to-slots.sql
-- Rename plugin identifier from 'kiosk' to 'slots' in access tables.
-- Run this on the main application database (where user_plugin_access and tenant_plugin_access live).

UPDATE user_plugin_access
SET plugin_name = 'slots'
WHERE plugin_name = 'kiosk';

UPDATE tenant_plugin_access
SET plugin_name = 'slots'
WHERE plugin_name = 'kiosk';
