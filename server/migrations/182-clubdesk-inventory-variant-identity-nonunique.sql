-- 182-clubdesk-inventory-variant-identity-nonunique.sql
-- Parity with garments migration 152: audience + color + size may repeat on the
-- same item (UI warns only). Drops unique index from 171.

DROP INDEX IF EXISTS idx_clubdesk_inventory_variants_identity;
