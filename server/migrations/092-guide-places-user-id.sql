-- 092-guide-places-user-id.sql
-- PostgreSQLAdapter adds user_id to all queries/inserts; guide_places must have this column.

ALTER TABLE guide_places ADD COLUMN IF NOT EXISTS user_id INTEGER;
UPDATE guide_places SET user_id = 1 WHERE user_id IS NULL;
ALTER TABLE guide_places ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_guide_places_user_id ON guide_places(user_id);
