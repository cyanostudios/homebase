-- 047-cups-add-user-id.sql
-- PostgreSQLAdapter adds user_id to all queries/inserts; cups tables must have this column.

ALTER TABLE cups ADD COLUMN IF NOT EXISTS user_id INTEGER;
UPDATE cups SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE cups ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS cups_user_id_idx ON cups (user_id);

ALTER TABLE cup_sources ADD COLUMN IF NOT EXISTS user_id INTEGER;
UPDATE cup_sources SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE cup_sources ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS cup_sources_user_id_idx ON cup_sources (user_id);
