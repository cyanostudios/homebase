-- 106-guides-place-presentation.sql
-- Place-level presentations replace stops × length variants (quick/normal/deep).

CREATE TABLE IF NOT EXISTS guide_presentations (
  id SERIAL PRIMARY KEY,
  master_guide_id INTEGER NOT NULL REFERENCES guide_master_guides(id) ON DELETE CASCADE,
  language VARCHAR(10) NOT NULL,
  presentation_text TEXT,
  publication_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  staleness_status VARCHAR(50) NOT NULL DEFAULT 'fresh',
  approval_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (master_guide_id, language)
);

CREATE INDEX IF NOT EXISTS idx_guide_presentations_master_guide_id
  ON guide_presentations(master_guide_id);

-- Migrate best text per (master_guide, language): prefer normal > deep > quick
INSERT INTO guide_presentations (
  master_guide_id,
  language,
  presentation_text,
  publication_status,
  staleness_status,
  approval_status,
  created_at,
  updated_at
)
SELECT DISTINCT ON (gs.master_guide_id, gvp.language)
  gs.master_guide_id,
  gvp.language,
  gvp.presentation_text,
  gvp.publication_status,
  gvp.staleness_status,
  COALESCE(gvp.approval_status, 'draft'),
  NOW(),
  NOW()
FROM guide_variant_presentations gvp
INNER JOIN guide_stops gs ON gs.id = gvp.stop_id
ORDER BY
  gs.master_guide_id,
  gvp.language,
  CASE gvp.variant_type
    WHEN 'normal' THEN 0
    WHEN 'deep' THEN 1
    WHEN 'quick' THEN 2
    ELSE 3
  END,
  gs.sequence_order ASC,
  gvp.id ASC
ON CONFLICT (master_guide_id, language) DO NOTHING;

-- Ensure every master guide has at least a source-language presentation row
INSERT INTO guide_presentations (master_guide_id, language, presentation_text)
SELECT mg.id, mg.source_language, NULL
FROM guide_master_guides mg
WHERE NOT EXISTS (
  SELECT 1 FROM guide_presentations gp
  WHERE gp.master_guide_id = mg.id AND gp.language = mg.source_language
)
ON CONFLICT (master_guide_id, language) DO NOTHING;

-- Production job items: add presentation_id, drop stop/variant FKs
ALTER TABLE guide_production_job_items
  ADD COLUMN IF NOT EXISTS presentation_id INTEGER REFERENCES guide_presentations(id) ON DELETE SET NULL;

-- Clear in-flight job linkage (historical items cannot map cleanly)
UPDATE guide_production_job_items SET presentation_id = NULL;
DELETE FROM guide_production_job_events;
DELETE FROM guide_production_job_items;
DELETE FROM guide_production_jobs;

ALTER TABLE guide_production_job_items DROP CONSTRAINT IF EXISTS guide_production_job_items_stop_id_fkey;
ALTER TABLE guide_production_job_items DROP CONSTRAINT IF EXISTS guide_production_job_items_variant_id_fkey;
ALTER TABLE guide_production_jobs DROP CONSTRAINT IF EXISTS guide_production_jobs_scope_stop_id_fkey;
ALTER TABLE guide_production_jobs DROP CONSTRAINT IF EXISTS guide_production_jobs_scope_variant_id_fkey;

ALTER TABLE guide_production_job_items DROP COLUMN IF EXISTS stop_id;
ALTER TABLE guide_production_job_items DROP COLUMN IF EXISTS variant_id;
ALTER TABLE guide_production_jobs DROP COLUMN IF EXISTS scope_stop_id;
ALTER TABLE guide_production_jobs DROP COLUMN IF EXISTS scope_variant_id;

ALTER TABLE guide_production_job_items
  ALTER COLUMN presentation_id SET NOT NULL;

-- Drop stop/variant/audio stack
DROP TABLE IF EXISTS guide_audio CASCADE;
DROP TABLE IF EXISTS guide_variant_presentations CASCADE;
DROP TABLE IF EXISTS guide_stops CASCADE;
