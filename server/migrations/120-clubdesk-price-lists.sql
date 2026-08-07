-- 120-clubdesk-price-lists.sql
-- Tenant DB: Clubdesk price lists + categorized reorderable items

CREATE TABLE IF NOT EXISTS clubdesk_price_lists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  featured_image_url TEXT,
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published')),
  currency VARCHAR(10) NOT NULL DEFAULT 'SEK',
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_price_lists_user_lower_slug
  ON clubdesk_price_lists (user_id, lower(slug));
CREATE INDEX IF NOT EXISTS idx_clubdesk_price_lists_user_id
  ON clubdesk_price_lists (user_id);
CREATE INDEX IF NOT EXISTS idx_clubdesk_price_lists_user_sort
  ON clubdesk_price_lists (user_id, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_clubdesk_price_lists_updated_at
  ON clubdesk_price_lists (updated_at DESC);

CREATE TABLE IF NOT EXISTS clubdesk_price_list_items (
  id SERIAL PRIMARY KEY,
  price_list_id INTEGER NOT NULL REFERENCES clubdesk_price_lists(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  category VARCHAR(100),
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_price_list_items_list_cat_seq
  ON clubdesk_price_list_items (
    price_list_id,
    (COALESCE(NULLIF(trim(category), ''), '')),
    sequence_order
  );
CREATE INDEX IF NOT EXISTS idx_clubdesk_price_list_items_list_id
  ON clubdesk_price_list_items (price_list_id);

CREATE TABLE IF NOT EXISTS clubdesk_price_list_item_categories (
  id SERIAL PRIMARY KEY,
  price_list_id INTEGER NOT NULL REFERENCES clubdesk_price_lists(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_pl_item_cats_list_lower_name
  ON clubdesk_price_list_item_categories (price_list_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_clubdesk_pl_item_cats_list_sort
  ON clubdesk_price_list_item_categories (price_list_id, sort_order ASC, id ASC);
