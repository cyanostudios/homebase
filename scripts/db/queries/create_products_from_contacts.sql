-- Create products table mirroring the current contacts schema (temporary compatibility).
CREATE TABLE IF NOT EXISTS public.products (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
  contact_number      VARCHAR(50)      NOT NULL,
  contact_type        VARCHAR(20)      DEFAULT 'company',
  company_name        VARCHAR(255)     NOT NULL,
  company_type        VARCHAR(50),
  organization_number VARCHAR(50),
  vat_number          VARCHAR(50),
  personal_number     VARCHAR(50),
  contact_persons     JSONB            DEFAULT '[]'::jsonb,
  addresses           JSONB            DEFAULT '[]'::jsonb,
  email               VARCHAR(255),
  phone               VARCHAR(50),
  phone2              VARCHAR(50),
  website             VARCHAR(255),
  tax_rate            VARCHAR(10),
  payment_terms       VARCHAR(10),
  currency            VARCHAR(10),
  f_tax               VARCHAR(10),
  notes               TEXT,
  created_at          TIMESTAMP        DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP        DEFAULT CURRENT_TIMESTAMP
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_user_contact_number ON public.products(user_id, contact_number);
