-- 141-garment-list-persons-jersey-name-initials.sql
-- Person-level text fields for jersey print name and initials.

ALTER TABLE garment_list_persons
  ADD COLUMN IF NOT EXISTS jersey_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS initials TEXT NULL;
