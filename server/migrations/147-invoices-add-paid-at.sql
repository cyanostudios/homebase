-- 147-invoices-add-paid-at.sql
-- Ensure paid_at exists on invoices (004-invoices.sql defines it, but older
-- tenant DBs created before that column was added never received it via
-- CREATE TABLE IF NOT EXISTS).

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;
