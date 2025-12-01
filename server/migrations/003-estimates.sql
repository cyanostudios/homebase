-- Estimates table migration
CREATE TABLE IF NOT EXISTS estimates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  estimate_number VARCHAR(50) NOT NULL UNIQUE,
  contact_id TEXT,
  contact_name TEXT DEFAULT '',
  organization_number TEXT DEFAULT '',
  currency VARCHAR(10) DEFAULT 'SEK',
  line_items JSONB DEFAULT '[]'::jsonb,
  estimate_discount DECIMAL(10,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  valid_to TIMESTAMP,
  subtotal DECIMAL(10,2) DEFAULT 0,
  total_discount DECIMAL(10,2) DEFAULT 0,
  subtotal_after_discount DECIMAL(10,2) DEFAULT 0,
  estimate_discount_amount DECIMAL(10,2) DEFAULT 0,
  subtotal_after_estimate_discount DECIMAL(10,2) DEFAULT 0,
  total_vat DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  acceptance_reasons JSONB DEFAULT '[]'::jsonb,
  rejection_reasons JSONB DEFAULT '[]'::jsonb,
  status_changed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Estimate shares table for public sharing
CREATE TABLE IF NOT EXISTS estimate_shares (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  share_token VARCHAR(255) NOT NULL UNIQUE,
  valid_until TIMESTAMP NOT NULL,
  accessed_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON estimates(user_id);
CREATE INDEX IF NOT EXISTS idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX IF NOT EXISTS idx_estimates_contact_id ON estimates(contact_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON estimates(status);
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_estimate_shares_token ON estimate_shares(share_token);
CREATE INDEX IF NOT EXISTS idx_estimate_shares_estimate_id ON estimate_shares(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_shares_valid_until ON estimate_shares(valid_until);