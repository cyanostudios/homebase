-- 027-orders-placed-at-timestamptz.sql
-- Fix order time 1h behind: use TIMESTAMP WITH TIME ZONE so node-pg returns UTC
-- and the client can display correct local time. Existing values treated as UTC.

ALTER TABLE orders
  ALTER COLUMN placed_at TYPE TIMESTAMP WITH TIME ZONE
  USING placed_at AT TIME ZONE 'UTC';
