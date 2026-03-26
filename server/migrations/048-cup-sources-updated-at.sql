-- 048-cup-sources-updated-at.sql
-- PostgreSQLAdapter.update() always sets updated_at; cup_sources must have this column.

ALTER TABLE cup_sources
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
