-- 038-slots-add-name-slot-end-address.sql
-- Add name (På slot), slot_end (end datetime), and address.

ALTER TABLE slots
  ADD COLUMN IF NOT EXISTS name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS slot_end TIMESTAMP,
  ADD COLUMN IF NOT EXISTS address VARCHAR(500);
