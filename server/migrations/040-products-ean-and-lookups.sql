-- 040-products-ean-and-lookups.sql
-- EAN as separate field; GTIN auto-filled from EAN (user can override).
-- Lookup tables: brands, suppliers, manufacturers (empty from start, user builds list).

-- 1. EAN column on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS ean VARCHAR(14);

-- 2. Lookup tables (empty initially)
CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_brands_user_id ON brands(user_id);

CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);

CREATE TABLE IF NOT EXISTS manufacturers (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_manufacturers_user_id ON manufacturers(user_id);

-- 3. FKs on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand_id INT REFERENCES brands(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id INT REFERENCES suppliers(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS manufacturer_id INT REFERENCES manufacturers(id) ON DELETE SET NULL;
