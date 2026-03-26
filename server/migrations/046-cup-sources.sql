-- 046-cup-sources.sql
-- Cup scrape sources: each row is a URL or uploaded file to scrape.

CREATE TABLE IF NOT EXISTS cup_sources (
  id              SERIAL PRIMARY KEY,
  type            VARCHAR(20)  NOT NULL DEFAULT 'url', -- 'url' | 'file'
  url             VARCHAR(1000),
  filename        VARCHAR(500),
  label           VARCHAR(255),
  enabled         BOOLEAN      NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMP,
  last_result     VARCHAR(100),
  created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);
