-- 159-invoices-status-partially-paid.sql
-- Add partially_paid to invoices.status check constraint.

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'canceled', 'partially_paid'));
