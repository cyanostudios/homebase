-- MAIN_DB_ONLY
-- Shared account (tenant) organization profile: name, logo, address, billing.
-- Used by Settings → Profile; later invoices/estimates can read the same source.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS organization JSONB NOT NULL DEFAULT '{}'::jsonb;
