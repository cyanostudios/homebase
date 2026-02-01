-- 004-invoices.sql
-- Invoices table for billing with payments and sharing

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  invoice_number VARCHAR(50),
  contact_id INT,
  contact_name VARCHAR(255),
  organization_number VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'SEK',
  line_items JSONB DEFAULT '[]',
  invoice_discount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  payment_terms TEXT,
  issue_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  invoice_type VARCHAR(50) DEFAULT 'invoice' CHECK (invoice_type IN ('invoice', 'credit_note', 'cash_invoice', 'receipt')),
  subtotal DECIMAL(12,2) DEFAULT 0,
  total_discount DECIMAL(12,2) DEFAULT 0,
  subtotal_after_discount DECIMAL(12,2) DEFAULT 0,
  invoice_discount_amount DECIMAL(12,2) DEFAULT 0,
  subtotal_after_invoice_discount DECIMAL(12,2) DEFAULT 0,
  total_vat DECIMAL(12,2) DEFAULT 0,
  total DECIMAL(12,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'canceled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  estimate_id INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_invoice_number ON invoices (user_id, invoice_number) WHERE invoice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

-- Invoice shares table
CREATE TABLE IF NOT EXISTS invoice_shares (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  share_token VARCHAR(64) NOT NULL UNIQUE,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accessed_count INT DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_invoice_shares_invoice_id ON invoice_shares(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_user_id ON invoice_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_share_token ON invoice_shares(share_token);