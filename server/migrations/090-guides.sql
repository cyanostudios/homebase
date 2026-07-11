-- 090-guides.sql
-- Guide CMS: Place and MasterGuide (Epic 1)

CREATE TABLE IF NOT EXISTS guide_places (
  id SERIAL PRIMARY KEY,
  display_name VARCHAR(255) NOT NULL,
  short_intro TEXT,
  geographic_reference VARCHAR(255),
  lifecycle_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS guide_master_guides (
  id SERIAL PRIMARY KEY,
  place_id INTEGER NOT NULL UNIQUE REFERENCES guide_places(id) ON DELETE CASCADE,
  source_language VARCHAR(10) NOT NULL DEFAULT 'sv',
  editorial_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guide_places_lifecycle_status ON guide_places(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_guide_places_updated_at ON guide_places(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_guide_master_guides_place_id ON guide_master_guides(place_id);
