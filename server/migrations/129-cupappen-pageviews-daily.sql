-- 129-cupappen-pageviews-daily.sql
-- Daily aggregate pageviews for Cupappen (cup detail + district listing).
-- Written by public-cups/api/pageview.php; read by Homebase plugins/cups stats API.

CREATE TABLE IF NOT EXISTS cupappen_pageviews_daily (
  day DATE NOT NULL,
  page_kind VARCHAR(16) NOT NULL CHECK (page_kind IN ('cup', 'district')),
  target_key VARCHAR(128) NOT NULL,
  source_bucket VARCHAR(16) NOT NULL
    CHECK (source_bucket IN ('direct', 'internal', 'search', 'social', 'other')),
  referrer_domain VARCHAR(255) NOT NULL DEFAULT '',
  views INTEGER NOT NULL DEFAULT 0 CHECK (views >= 0),
  PRIMARY KEY (day, page_kind, target_key, source_bucket, referrer_domain)
);

CREATE INDEX IF NOT EXISTS idx_cupappen_pv_day_kind
  ON cupappen_pageviews_daily (day, page_kind);
