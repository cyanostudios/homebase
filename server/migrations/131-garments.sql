-- 131-garments.sql
-- Tenant DB: garment lists, persons, shares, and inventory

CREATE TABLE IF NOT EXISTS garment_lists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  team_id INTEGER NULL REFERENCES teams(id) ON DELETE SET NULL,
  checkbox_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_garment_lists_user ON garment_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_garment_lists_team ON garment_lists(team_id);

CREATE TABLE IF NOT EXISTS garment_list_persons (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES garment_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  shirt_size TEXT NULL,
  shorts_size TEXT NULL,
  socks_size TEXT NULL,
  jersey_number TEXT NULL,
  comment TEXT NULL,
  checkbox_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_garment_list_persons_list ON garment_list_persons(list_id);

CREATE TABLE IF NOT EXISTS garment_list_shares (
  id SERIAL PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES garment_lists(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  valid_until TIMESTAMP NOT NULL,
  accessed_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garment_list_shares_list ON garment_list_shares(list_id);
CREATE INDEX IF NOT EXISTS idx_garment_list_shares_valid_until ON garment_list_shares(valid_until);
CREATE INDEX IF NOT EXISTS idx_garment_list_shares_token ON garment_list_shares(share_token);

CREATE TABLE IF NOT EXISTS garment_inventory_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  article_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_garment_inventory_user ON garment_inventory_items(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_garment_inventory_unique_article
  ON garment_inventory_items (user_id, lower(article_name), lower(brand), lower(size));
