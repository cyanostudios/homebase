CREATE TABLE IF NOT EXISTS estimates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  estimate_number TEXT NOT NULL,
  contact_id INTEGER NULL,
  contact_name TEXT DEFAULT '',
  organization_number TEXT DEFAULT '',
  currency TEXT DEFAULT 'SEK',
  line_items JSONB NOT NULL DEFAULT '[]',
  estimate_discount NUMERIC(5,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  valid_to TIMESTAMP NULL,

  subtotal NUMERIC(12,2) DEFAULT 0,
  total_discount NUMERIC(12,2) DEFAULT 0,
  subtotal_after_discount NUMERIC(12,2) DEFAULT 0,
  estimate_discount_amount NUMERIC(12,2) DEFAULT 0,
  subtotal_after_estimate_discount NUMERIC(12,2) DEFAULT 0,
  total_vat NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,

  status TEXT DEFAULT 'draft',
  acceptance_reasons TEXT,        -- skickas som JSON-string
  rejection_reasons TEXT,         -- skickas som JSON-string
  status_changed_at TIMESTAMP NULL,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimates_user ON estimates(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_estimates_number ON estimates(estimate_number);
