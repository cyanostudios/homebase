-- 064-drop-public-products.sql
-- Tenant är enda sanningen för produktdata. public.products ska inte existera.
-- Körs via run-all-migrations (search_path tenant_X); public.products refereras explicit.

DROP TABLE IF EXISTS public.products CASCADE;
