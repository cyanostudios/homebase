-- 085-schedule-add-user-id.sql
-- schedules / schedule_events need user_id for tenant Database.insert()

ALTER TABLE schedules ADD COLUMN IF NOT EXISTS user_id INT;
ALTER TABLE schedule_events ADD COLUMN IF NOT EXISTS user_id INT;

UPDATE schedules SET user_id = 1 WHERE user_id IS NULL;
UPDATE schedule_events SET user_id = 1 WHERE user_id IS NULL;

ALTER TABLE schedules ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE schedule_events ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_events_user_id ON schedule_events(user_id);
