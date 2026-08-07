-- 123-clubdesk-swish-profiles.sql
-- Tenant DB: Swish Type C profiles + M:N links to price lists (admin; public lookup later)

CREATE TABLE IF NOT EXISTS clubdesk_swish_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  payee VARCHAR(32) NOT NULL,
  message VARCHAR(50) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubdesk_swish_profiles_user_id
  ON clubdesk_swish_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_clubdesk_swish_profiles_user_sort
  ON clubdesk_swish_profiles (user_id, sort_order ASC, id ASC);

CREATE TABLE IF NOT EXISTS clubdesk_swish_profile_price_lists (
  profile_id INTEGER NOT NULL
    REFERENCES clubdesk_swish_profiles(id) ON DELETE CASCADE,
  price_list_id INTEGER NOT NULL
    REFERENCES clubdesk_price_lists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, price_list_id)
);

-- At most one Swish profile per price list (etapp 2 cart QR needs unambiguous lookup).
CREATE UNIQUE INDEX IF NOT EXISTS idx_clubdesk_swish_pl_price_list_unique
  ON clubdesk_swish_profile_price_lists (price_list_id);

CREATE INDEX IF NOT EXISTS idx_clubdesk_swish_pl_profile_id
  ON clubdesk_swish_profile_price_lists (profile_id);

-- One-shot: migrate singleton site-content swish.meta → first profile (payee + message only).
INSERT INTO clubdesk_swish_profiles (user_id, payee, message, sort_order)
SELECT
  sc.user_id,
  LEFT(BTRIM(COALESCE(sc.meta->>'payee', '')), 32),
  LEFT(
    BTRIM(REPLACE(COALESCE(sc.meta->>'message', ''), ';', ' ')),
    50
  ),
  1
FROM clubdesk_site_content sc
WHERE sc.card_key = 'swish'
  AND BTRIM(COALESCE(sc.meta->>'payee', '')) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM clubdesk_swish_profiles p WHERE p.user_id = sc.user_id
  );

UPDATE clubdesk_site_content
SET content = '',
    meta = '{}'::jsonb,
    updated_at = NOW()
WHERE card_key = 'swish'
  AND meta <> '{}'::jsonb;
