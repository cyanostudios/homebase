-- 001-initial-schema.sql
-- Homebase Multi-Tenant Schema
-- Creates contacts and notes tables for each tenant database

-- Contacts Table
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  contact_number VARCHAR(50),
  contact_type VARCHAR(50),
  company_name VARCHAR(255),
  company_type VARCHAR(50),
  organization_number VARCHAR(50),
  vat_number VARCHAR(50),
  personal_number VARCHAR(50),
  contact_persons JSONB,
  addresses JSONB,
  email VARCHAR(255),
  phone VARCHAR(50),
  phone2 VARCHAR(50),
  website VARCHAR(255),
  tax_rate INT,
  payment_terms INT,
  currency VARCHAR(10),
  kvitto VARCHAR(10),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_company_name ON contacts(company_name);
CREATE INDEX idx_contacts_contact_type ON contacts(contact_type);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255),
  content TEXT,
  mentions JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_created_at ON notes(created_at);