-- 037-slots-add-description.sql
-- Add optional description (textarea) to slots.

ALTER TABLE slots
  ADD COLUMN IF NOT EXISTS description TEXT;
