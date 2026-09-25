-- 171-clubdesk-inventory.sql
-- Tenant DB: Clubdesk inventory catalog (articles + variants), distinct from garment_inventory_*

CREATE TABLE IF NOT EXISTS clubdesk_inventory_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  article_name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  description TEXT,
  material TEXT NOT NULL DEFAULT '',
  purchase_price NUMERIC(12, 2) NULL,
  recommended_price NUMERIC(12, 2) NULL,
  sale_price NUMERIC(12, 2) NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'SEK',
  comment TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  slug VARCHAR(255) NOT NULL,
  featured_image_url TEXT,
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published')),
  featured BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_user_article_brand
  ON clubdesk_inventory_items (user_id, lower(article_name), lower(brand));

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_user_lower_slug
  ON clubdesk_inventory_items (user_id, lower(slug));

CREATE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_user_id
  ON clubdesk_inventory_items (user_id);

CREATE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_user_publication
  ON clubdesk_inventory_items (user_id, publication_status);

CREATE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_updated_at
  ON clubdesk_inventory_items (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_clubdesk_inventory_items_user_sort
  ON clubdesk_inventory_items (user_id, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS clubdesk_inventory_variants (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES clubdesk_inventory_items(id) ON DELETE CASCADE,
  sku TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_clubdesk_inventory_variants_item
  ON clubdesk_inventory_variants (item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_inventory_variants_identity
  ON clubdesk_inventory_variants (
    item_id,
    lower(audience),
    lower(color),
    lower(size)
  );
