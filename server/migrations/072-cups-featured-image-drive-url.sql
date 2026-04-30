-- 072-cups-featured-image-drive-url.sql
-- Optional Google Drive link for featured cup image fallback/normalization.

ALTER TABLE cups ADD COLUMN IF NOT EXISTS featured_image_drive_url TEXT;
