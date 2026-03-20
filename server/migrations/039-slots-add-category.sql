-- 039-slots-add-category.sql
-- Add category/tag field for slots.

ALTER TABLE slots
  ADD COLUMN IF NOT EXISTS category VARCHAR(100);
