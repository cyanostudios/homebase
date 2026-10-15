-- Optional display of supply date (leveransdatum) on invoice PDF/preview.
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS show_supply_date BOOLEAN NOT NULL DEFAULT true;
