-- 093-guide-stops.sql
-- Guide CMS Epic 3: GuideStop under MasterGuide

CREATE TABLE IF NOT EXISTS guide_stops (
  id SERIAL PRIMARY KEY,
  master_guide_id INTEGER NOT NULL REFERENCES guide_master_guides(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  sequence_order INTEGER NOT NULL,
  canonical_narrative TEXT,
  editorial_status VARCHAR(50) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_guide_stops_master_sequence
  ON guide_stops(master_guide_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_guide_stops_master_guide_id ON guide_stops(master_guide_id);
