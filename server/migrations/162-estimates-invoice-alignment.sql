-- 162-estimates-invoice-alignment.sql
-- Order/delivery fields on estimates; status includes invoiced (convert-to-invoice).

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(100) DEFAULT '';

ALTER TABLE estimates
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(100) DEFAULT '';

ALTER TABLE estimates
  DROP CONSTRAINT IF EXISTS estimates_status_check;

ALTER TABLE estimates
  ADD CONSTRAINT estimates_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'invoiced'));

-- At most one invoice per estimate (convert-to-invoice idempotency).
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_estimate_id_unique
  ON invoices (estimate_id)
  WHERE estimate_id IS NOT NULL;
