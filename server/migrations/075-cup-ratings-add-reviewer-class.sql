-- Optional class/age group next to club on cup ratings (e.g. F16, P12).
ALTER TABLE cup_ratings
ADD COLUMN IF NOT EXISTS reviewer_class VARCHAR(40);
