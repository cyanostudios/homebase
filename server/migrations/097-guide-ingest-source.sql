-- 097-guide-ingest-source.sql
-- Content Production Pipeline P5: link Guide Place to Ingest source + pinned run

ALTER TABLE guide_places
  ADD COLUMN IF NOT EXISTS ingest_source_id INTEGER REFERENCES ingest_sources(id) ON DELETE SET NULL;

ALTER TABLE guide_places
  ADD COLUMN IF NOT EXISTS ingest_run_id INTEGER REFERENCES ingest_runs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guide_places_ingest_source_id ON guide_places(ingest_source_id);
CREATE INDEX IF NOT EXISTS idx_guide_places_ingest_run_id ON guide_places(ingest_run_id);
