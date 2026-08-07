-- 119-clubdesk-guides.sql
-- Tenant DB: Clubdesk guides (Instructions clone) + steps + categories

CREATE TABLE IF NOT EXISTS clubdesk_guides (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  featured_image_url TEXT,
  category VARCHAR(100),
  publication_status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (publication_status IN ('draft', 'published')),
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_guides_user_lower_slug
  ON clubdesk_guides (user_id, lower(slug));
CREATE INDEX IF NOT EXISTS idx_clubdesk_guides_publication_status
  ON clubdesk_guides (publication_status);
CREATE INDEX IF NOT EXISTS idx_clubdesk_guides_updated_at
  ON clubdesk_guides (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clubdesk_guides_user_id
  ON clubdesk_guides (user_id);
CREATE INDEX IF NOT EXISTS idx_clubdesk_guides_user_category_sort
  ON clubdesk_guides (
    user_id,
    (COALESCE(NULLIF(trim(category), ''), '')),
    sort_order ASC,
    id ASC
  );

CREATE TABLE IF NOT EXISTS clubdesk_guide_steps (
  id SERIAL PRIMARY KEY,
  guide_id INTEGER NOT NULL REFERENCES clubdesk_guides(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_order INTEGER NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_guide_steps_guide_sequence
  ON clubdesk_guide_steps (guide_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_clubdesk_guide_steps_guide_id
  ON clubdesk_guide_steps (guide_id);

CREATE TABLE IF NOT EXISTS clubdesk_guide_categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_guide_categories_user_lower_name
  ON clubdesk_guide_categories (user_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_clubdesk_guide_categories_user_sort
  ON clubdesk_guide_categories (user_id, sort_order ASC, id ASC);
