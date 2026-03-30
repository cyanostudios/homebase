-- 060-cups-upsert-index.sql
-- Enforce one row per ingest source + external_id for atomic upserts (cups import dedupe).

CREATE UNIQUE INDEX IF NOT EXISTS idx_cups_ingest_source_ext_id
  ON cups (ingest_source_id, external_id)
  WHERE external_id IS NOT NULL;
