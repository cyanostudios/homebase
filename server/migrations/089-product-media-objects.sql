-- Track product-owned hosted media objects so we can delete managed B2 files safely.

CREATE TABLE IF NOT EXISTS product_media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  created_by_user_id TEXT,
  source_kind TEXT NOT NULL,
  source_url TEXT,
  original_filename TEXT,
  storage_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS product_media_objects_product_id_idx
  ON product_media_objects (product_id);

CREATE INDEX IF NOT EXISTS product_media_objects_created_by_user_id_idx
  ON product_media_objects (created_by_user_id);

CREATE INDEX IF NOT EXISTS product_media_objects_product_source_url_idx
  ON product_media_objects (product_id, source_url);
