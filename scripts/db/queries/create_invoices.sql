-- TABLE: invoices
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  invoice_number TEXT,                                   -- sätts när status -> 'sent'
  contact_id BIGINT,
  contact_name TEXT DEFAULT '',
  organization_number TEXT DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'SEK',
  line_items JSONB NOT NULL DEFAULT '[]',
  invoice_discount NUMERIC(10,2) NOT NULL DEFAULT 0,     -- procent
  notes TEXT DEFAULT '',
  issue_date TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,

  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_after_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  invoice_discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal_after_invoice_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_vat NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','paid','overdue','canceled')),
  status_changed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  estimate_id BIGINT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Unikt löpnummer per användare (tillåter flera NULL)
CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_invoice_number_uidx
  ON invoices (user_id, invoice_number);

CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices (user_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON invoices (created_at);

-- TABLE: invoice_shares
CREATE TABLE IF NOT EXISTS invoice_shares (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS invoice_shares_invoice_idx ON invoice_shares (invoice_id);
CREATE INDEX IF NOT EXISTS invoice_shares_user_idx ON invoice_shares (user_id);
