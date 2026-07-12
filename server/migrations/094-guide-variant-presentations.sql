-- 094-guide-variant-presentations.sql
-- Guide CMS Epic 4: VariantPresentation under GuideStop

CREATE TABLE IF NOT EXISTS guide_variant_presentations (
  id SERIAL PRIMARY KEY,
  stop_id INTEGER NOT NULL REFERENCES guide_stops(id) ON DELETE CASCADE,
  variant_type VARCHAR(50) NOT NULL,
  language VARCHAR(10) NOT NULL,
  presentation_text TEXT,
  publication_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  staleness_status VARCHAR(50) NOT NULL DEFAULT 'fresh',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guide_variant_presentations_stop_variant_lang
  ON guide_variant_presentations(stop_id, variant_type, language);

CREATE INDEX IF NOT EXISTS idx_guide_variant_presentations_stop_id
  ON guide_variant_presentations(stop_id);

-- Backfill default variants for existing stops (Quick / Normal / Deep in source language)
INSERT INTO guide_variant_presentations (
  stop_id,
  variant_type,
  language,
  publication_status,
  staleness_status
)
SELECT
  gs.id,
  v.variant_type,
  mg.source_language,
  'draft',
  'fresh'
FROM guide_stops gs
INNER JOIN guide_master_guides mg ON mg.id = gs.master_guide_id
CROSS JOIN (
  VALUES ('quick'), ('normal'), ('deep')
) AS v(variant_type)
ON CONFLICT (stop_id, variant_type, language) DO NOTHING;
