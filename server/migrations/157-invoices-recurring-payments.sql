-- 157-invoices-recurring-payments.sql
-- Recurring invoice schedules + payment ledger for invoices plugin MVP.

CREATE TABLE IF NOT EXISTS invoice_recurring_schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  name VARCHAR(255) NOT NULL DEFAULT '',
  contact_id INTEGER,
  contact_name VARCHAR(255) DEFAULT '',
  organization_number VARCHAR(50) DEFAULT '',
  currency VARCHAR(10) DEFAULT 'SEK',
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  invoice_discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',
  interval_unit VARCHAR(20) NOT NULL DEFAULT 'month'
    CHECK (interval_unit IN ('month', 'quarter', 'year')),
  interval_count INTEGER NOT NULL DEFAULT 1 CHECK (interval_count >= 1),
  next_run_date DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_recurring_schedules_active_next
  ON invoice_recurring_schedules (active, next_run_date);

CREATE INDEX IF NOT EXISTS idx_invoice_recurring_schedules_user_id
  ON invoice_recurring_schedules (user_id);

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS recurring_schedule_id INTEGER;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_recurring_schedule_id_fkey'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_recurring_schedule_id_fkey
      FOREIGN KEY (recurring_schedule_id)
      REFERENCES invoice_recurring_schedules(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_recurring_schedule_id
  ON invoices (recurring_schedule_id);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice_id
  ON invoice_payments (invoice_id);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_user_id
  ON invoice_payments (user_id);
