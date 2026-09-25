-- 169-sportadmin-cron-opt-in.sql
-- Tenant DB: cron opt-in (default off for beta) + daily refresh interval default.

ALTER TABLE sportadmin_config
  ADD COLUMN IF NOT EXISTS cron_enabled BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE sportadmin_config
  ALTER COLUMN refresh_interval_minutes SET DEFAULT 1440;

UPDATE sportadmin_config
   SET refresh_interval_minutes = 1440
 WHERE refresh_interval_minutes <> 1440;
