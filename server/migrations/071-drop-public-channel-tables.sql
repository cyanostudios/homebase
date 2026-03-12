-- 071-drop-public-channel-tables.sql
-- Tenant är enda sanningen för kanaldata. public.channel_* ska inte existera.
-- Körs via run-all-migrations; public-tabellerna refereras explicit.
-- Ordning: barn före föräldrar (channel_product_* refererar channel_instances).

DROP TABLE IF EXISTS public.channel_product_overrides CASCADE;
DROP TABLE IF EXISTS public.channel_product_map CASCADE;
DROP TABLE IF EXISTS public.channel_error_log CASCADE;
DROP TABLE IF EXISTS public.channel_instances CASCADE;
