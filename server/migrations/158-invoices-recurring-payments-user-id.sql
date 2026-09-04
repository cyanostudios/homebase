-- 158-invoices-recurring-payments-user-id.sql
-- Tenant isolation requires user_id on plugin tables queried via Database adapter.

ALTER TABLE invoice_recurring_schedules
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

ALTER TABLE invoice_payments
  ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Backfill from linked invoice when possible (payments).
UPDATE invoice_payments p
SET user_id = i.user_id
FROM invoices i
WHERE p.invoice_id = i.id
  AND p.user_id IS NULL
  AND i.user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoice_recurring_schedules_user_id
  ON invoice_recurring_schedules (user_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_user_id
  ON invoice_payments (user_id);
