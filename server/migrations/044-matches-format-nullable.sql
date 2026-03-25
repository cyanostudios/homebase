-- 044-matches-format-nullable.sql
-- Make matches.format nullable to support optional format in UI/API.

ALTER TABLE matches
  ALTER COLUMN format DROP NOT NULL;

