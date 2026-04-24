-- 071-cups-featured-image-url.sql
-- Hero image for featured cup cards on the public Cupappen site (uploaded in platform).

ALTER TABLE cups ADD COLUMN IF NOT EXISTS featured_image_url TEXT;
