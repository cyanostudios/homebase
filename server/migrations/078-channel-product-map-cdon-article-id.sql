-- 078-channel-product-map-cdon-article-id.sql
-- CDON article ID for product links (URL uses CDON's ID, API uses SKU in external_id).

ALTER TABLE channel_product_map ADD COLUMN IF NOT EXISTS cdon_article_id VARCHAR(255);
