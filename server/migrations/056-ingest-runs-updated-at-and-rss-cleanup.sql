-- 056-ingest-runs-updated-at-and-rss-cleanup.sql
-- Tenant DB: ingest_runs needs updated_at for db.update(); normalize legacy source_type.

ALTER TABLE ingest_runs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE ingest_sources SET source_type = 'other' WHERE source_type = 'rss';
