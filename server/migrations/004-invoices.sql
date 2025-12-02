-- 004-invoices.sql
-- Invoices table for billing with payments and sharing

CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  contact_id INT,
  contact_name VARCHAR(255),
  organization_number VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'SEK',
  line_items JSONB,
  invoice_discount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  due_date DATE,
  subtotal DECIMAL(10,2),
  total_discount DECIMAL(10,2),
  subtotal_after_discount DECIMAL(10,2),
  invoice_discount_amount DECIMAL(10,2),
  subtotal_after_invoice_discount DECIMAL(10,2),
  total_vat DECIMAL(10,2),
  total DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'draft',
  paid_at TIMESTAMP,
  share_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_share_token ON invoices(share_token);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);