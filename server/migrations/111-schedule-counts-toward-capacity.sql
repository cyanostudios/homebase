-- 111-schedule-counts-toward-capacity.sql
-- Per-event flag: whether the session counts toward booked / available hours

ALTER TABLE schedule_events
  ADD COLUMN IF NOT EXISTS counts_toward_capacity BOOLEAN NOT NULL DEFAULT true;
