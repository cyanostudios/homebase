-- 164-invoices-ml-vat-compliance.sql
-- ML VAT compliance (epics A–E): supply date, content profile, credit link,
-- per-rate VAT cache, immutable issue snapshots.
-- Application enforces credit-note / förenklad / lock rules (no hard CHECK on
-- legacy credit notes that may lack a link). Local-first; prod only on release.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS supply_date TIMESTAMPTZ;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS content_profile VARCHAR(20) NOT NULL DEFAULT 'full';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS credited_invoice_id INT REFERENCES invoices(id) ON DELETE RESTRICT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS credited_invoice_number VARCHAR(50);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS correction_summary TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vat_breakdown JSONB;

CREATE INDEX IF NOT EXISTS idx_invoices_credited_invoice_id
  ON invoices (credited_invoice_id)
  WHERE credited_invoice_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS invoice_issue_snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  content_hash VARCHAR(64) NOT NULL,
  snapshot_json JSONB NOT NULL,
  pdf_bytes BYTEA,
  pdf_sha256 VARCHAR(64),
  CONSTRAINT invoice_issue_snapshots_invoice_id_unique UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_issue_snapshots_user_id
  ON invoice_issue_snapshots (user_id);
