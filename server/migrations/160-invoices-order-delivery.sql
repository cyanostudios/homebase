-- 160-invoices-order-delivery.sql
-- Optional order number and delivery method shown on invoice documents.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS order_number VARCHAR(100);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(100);
