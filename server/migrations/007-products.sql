-- 007-products.sql
-- Products table for product catalog management

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  product_number VARCHAR(50),
  sku VARCHAR(255),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'for sale',
  quantity INT DEFAULT 0,
  price_amount NUMERIC(12,2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'SEK',
  vat_rate NUMERIC(5,2) DEFAULT 25,
  main_image VARCHAR(500),
  images JSONB NOT NULL DEFAULT '[]',
  categories JSONB NOT NULL DEFAULT '[]',
  brand VARCHAR(255),
  gtin VARCHAR(14),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_products_product_number ON products(product_number);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_created_at ON products(created_at);

-- Unique constraint for product_number per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_user_product_number 
  ON products(user_id, product_number) 
  WHERE product_number IS NOT NULL;

-- Unique constraint for sku per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_user_sku 
  ON products(user_id, sku) 
  WHERE sku IS NOT NULL;
