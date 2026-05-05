-- 074-cup-ratings-add-club.sql
-- Add optional club/association field to cup ratings.

ALTER TABLE cup_ratings
ADD COLUMN IF NOT EXISTS reviewer_club VARCHAR(120);
