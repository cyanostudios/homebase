-- 048-category-cache.sql
-- Cache for channel categories; CDON/Fyndiq shared (user_id NULL), Woo per user.
-- Used by GET /api/products/category-cache and background job that fills it.

CREATE TABLE IF NOT EXISTS category_cache (
  cache_key TEXT NOT NULL,
  user_id INT NULL,
  payload JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per (cache_key, user_id). For shared cache (user_id NULL) one row per cache_key.
CREATE UNIQUE INDEX IF NOT EXISTS ux_category_cache_key_user
  ON category_cache(cache_key, COALESCE(user_id, -1));

COMMENT ON TABLE category_cache IS 'Channel category cache: CDON/Fyndiq shared (user_id NULL), Woo per user.';
