-- 122-clubdesk-site-content.sql
-- Tenant DB: Clubdesk Info page content cards (home / info / swish)

CREATE TABLE IF NOT EXISTS clubdesk_site_content (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  card_key VARCHAR(32) NOT NULL
    CHECK (card_key IN ('home', 'info', 'swish')),
  content TEXT NOT NULL DEFAULT '',
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, card_key)
);

CREATE INDEX IF NOT EXISTS idx_clubdesk_site_content_user_id
  ON clubdesk_site_content (user_id);
