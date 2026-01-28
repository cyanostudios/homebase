-- 003-estimates.sql
-- Estimates table for quotes and proposals with sharing and status tracking

CREATE TABLE IF NOT EXISTS estimates (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  estimate_number VARCHAR(50) NOT NULL,
  contact_id INT,
  contact_name VARCHAR(255),
  organization_number VARCHAR(50),
  currency VARCHAR(10) DEFAULT 'SEK',
  line_items JSONB,
  estimate_discount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  valid_to DATE,
  subtotal DECIMAL(10,2),
  total_discount DECIMAL(10,2),
  subtotal_after_discount DECIMAL(10,2),
  estimate_discount_amount DECIMAL(10,2),
  subtotal_after_estimate_discount DECIMAL(10,2),
  total_vat DECIMAL(10,2),
  total DECIMAL(10,2),
  status VARCHAR(50) DEFAULT 'draft',
  acceptance_reasons JSONB,
  rejection_reasons JSONB,
  status_changed_at TIMESTAMP,
  share_token VARCHAR(64) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_estimates_user_id ON estimates(user_id);
CREATE INDEX idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX idx_estimates_contact_id ON estimates(contact_id);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_valid_to ON estimates(valid_to);
CREATE INDEX idx_estimates_share_token ON estimates(share_token);
CREATE INDEX idx_estimates_created_at ON estimates(created_at);

-- Estimate shares table for sharing estimates with external users
CREATE TABLE IF NOT EXISTS estimate_shares (
  id SERIAL PRIMARY KEY,
  estimate_id INTEGER NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  valid_until TIMESTAMP NOT NULL,
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_shares_estimate ON estimate_shares(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_shares_valid_until ON estimate_shares(valid_until);