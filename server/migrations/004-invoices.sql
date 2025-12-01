-- Invoices table migration
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  invoice_number VARCHAR(50) UNIQUE,
  contact_id INTEGER,
  contact_name TEXT DEFAULT '',
  organization_number TEXT DEFAULT '',
  currency VARCHAR(10) DEFAULT 'SEK',
  line_items JSONB DEFAULT '[]'::jsonb,
  invoice_discount DECIMAL(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',
  issue_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  due_date TIMESTAMP,
  subtotal DECIMAL(10,2) DEFAULT 0,
  total_discount DECIMAL(10,2) DEFAULT 0,
  subtotal_after_discount DECIMAL(10,2) DEFAULT 0,
  invoice_discount_amount DECIMAL(10,2) DEFAULT 0,
  subtotal_after_invoice_discount DECIMAL(10,2) DEFAULT 0,
  total_vat DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  status_changed_at TIMESTAMP,
  paid_at TIMESTAMP,
  estimate_id INTEGER,
  invoice_type VARCHAR(50) DEFAULT 'invoice',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice shares table for public sharing
CREATE TABLE IF NOT EXISTS invoice_shares (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  share_token VARCHAR(255) NOT NULL UNIQUE,
  valid_until TIMESTAMP NOT NULL,
  accessed_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_estimate_id ON invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_token ON invoice_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_invoice_id ON invoice_shares(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_user_id ON invoice_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_valid_until ON invoice_shares(valid_until);