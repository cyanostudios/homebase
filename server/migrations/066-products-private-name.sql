-- 066-products-private-name.sql
-- Eget namn (intern produktnamn från Sello private_name, visas inte för kund).

ALTER TABLE products ADD COLUMN IF NOT EXISTS private_name VARCHAR(255);
