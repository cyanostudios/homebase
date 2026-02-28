-- 053-shipping-postnord.sql
-- PostNord shipping plugin: settings, senders and service presets.

CREATE TABLE IF NOT EXISTS postnord_settings (
  user_id INT NOT NULL,
  booking_url TEXT NULL,
  auth_scheme VARCHAR(64) NULL,
  integration_id TEXT NULL,
  api_key TEXT NULL,
  api_secret TEXT NULL,
  api_key_header_name TEXT NULL,
  label_format VARCHAR(10) NOT NULL DEFAULT 'PDF',
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_postnord_settings_user_id ON postnord_settings(user_id);

CREATE TABLE IF NOT EXISTS shipping_senders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  street VARCHAR(255) NULL,
  postal_code VARCHAR(50) NULL,
  city VARCHAR(255) NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'SE',
  contact_name VARCHAR(255) NULL,
  contact_phone VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_senders_user_id ON shipping_senders(user_id);

CREATE TABLE IF NOT EXISTS shipping_service_presets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, code)
);

CREATE INDEX IF NOT EXISTS idx_shipping_service_presets_user_id ON shipping_service_presets(user_id);
-- 053-shipping-postnord.sql
-- PostNord API settings and shipping senders (per-user)

CREATE TABLE IF NOT EXISTS postnord_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  api_key TEXT,
  api_secret TEXT,
  connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_postnord_settings_user_id
  ON postnord_settings(user_id);

CREATE TABLE IF NOT EXISTS shipping_senders (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  street VARCHAR(255),
  postal_code VARCHAR(50),
  city VARCHAR(255),
  country VARCHAR(2) DEFAULT 'SE',
  contact_name VARCHAR(255),
  contact_phone VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_senders_user_id ON shipping_senders(user_id);
