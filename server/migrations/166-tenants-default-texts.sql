-- MAIN_DB_ONLY
-- Shared account (tenant) default mail texts for invoices/estimates send dialogs.
-- Used by Settings → Default texts; BulkEmailDialog reads the same source.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_texts JSONB NOT NULL DEFAULT '{}'::jsonb;
