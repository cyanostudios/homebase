-- 036-products-lagerplats.sql
-- Lagerplats (frivillig) enligt Produktdetaljer.md

ALTER TABLE products ADD COLUMN IF NOT EXISTS lagerplats VARCHAR(100);
