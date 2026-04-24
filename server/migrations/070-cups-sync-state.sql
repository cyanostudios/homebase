-- 070-cups-sync-state.sql
-- Add mark-and-sweep columns to cups: last_seen_at and deleted_at (soft delete).

ALTER TABLE cups ADD COLUMN IF NOT EXISTS last_seen_at  TIMESTAMPTZ;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS deleted_at    TIMESTAMPTZ;

-- Efficient sweep: find all cups for a source not seen since a given timestamp.
CREATE INDEX IF NOT EXISTS idx_cups_ingest_source_last_seen
  ON cups (ingest_source_id, last_seen_at)
  WHERE ingest_source_id IS NOT NULL;
