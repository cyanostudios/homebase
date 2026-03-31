-- 061-cups-match-format-team-count.sql
-- Optional match format (English display) and team count from ingest (e.g. Småland).

ALTER TABLE cups ADD COLUMN IF NOT EXISTS team_count INTEGER;
ALTER TABLE cups ADD COLUMN IF NOT EXISTS match_format VARCHAR(512);
