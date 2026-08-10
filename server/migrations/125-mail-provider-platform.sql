-- 125-mail-provider-platform.sql
-- Multi-provider settings + routing for Mail (email), mirroring Pulse pattern.
-- Backfills from legacy mail_settings. Runtime should use new tables only.

CREATE TABLE IF NOT EXISTS mail_provider_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  provider_key VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  secret_primary TEXT,
  secret_secondary TEXT,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_mail_provider_settings_user_id
  ON mail_provider_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_mail_provider_settings_provider_key
  ON mail_provider_settings(provider_key);

CREATE TABLE IF NOT EXISTS mail_provider_routing (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  scope VARCHAR(100) NOT NULL,
  provider_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_mail_provider_routing_user_id
  ON mail_provider_routing(user_id);

CREATE INDEX IF NOT EXISTS idx_mail_provider_routing_scope
  ON mail_provider_routing(scope);

-- Backfill SMTP rows
INSERT INTO mail_provider_settings (
  user_id, provider_key, enabled, secret_primary, secret_secondary, options, created_at, updated_at
)
SELECT
  ms.user_id,
  'smtp',
  TRUE,
  NULL,
  NULLIF(TRIM(COALESCE(ms.auth_pass, '')), ''),
  jsonb_strip_nulls(
    jsonb_build_object(
      'host', NULLIF(TRIM(COALESCE(ms.host, '')), ''),
      'port', NULLIF(TRIM(COALESCE(ms.port::text, '')), ''),
      'secure', CASE WHEN ms.secure THEN 'true' ELSE 'false' END,
      'authUser', NULLIF(TRIM(COALESCE(ms.auth_user, '')), ''),
      'fromAddress', NULLIF(TRIM(COALESCE(ms.from_address, '')), '')
    )
  ),
  COALESCE(ms.created_at, NOW()),
  COALESCE(ms.updated_at, NOW())
FROM mail_settings ms
WHERE NULLIF(TRIM(COALESCE(ms.host, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ms.from_address, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ms.auth_pass, '')), '') IS NOT NULL
ON CONFLICT (user_id, provider_key) DO UPDATE SET
  secret_secondary = COALESCE(
    NULLIF(TRIM(EXCLUDED.secret_secondary), ''),
    mail_provider_settings.secret_secondary
  ),
  options = mail_provider_settings.options || EXCLUDED.options,
  enabled = TRUE,
  updated_at = NOW();

-- Backfill Resend rows
INSERT INTO mail_provider_settings (
  user_id, provider_key, enabled, secret_primary, secret_secondary, options, created_at, updated_at
)
SELECT
  ms.user_id,
  'resend',
  TRUE,
  NULLIF(TRIM(COALESCE(ms.resend_api_key, '')), ''),
  NULL,
  jsonb_strip_nulls(
    jsonb_build_object(
      'fromAddress', NULLIF(TRIM(COALESCE(ms.resend_from_address, '')), '')
    )
  ),
  COALESCE(ms.created_at, NOW()),
  COALESCE(ms.updated_at, NOW())
FROM mail_settings ms
WHERE NULLIF(TRIM(COALESCE(ms.resend_api_key, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ms.resend_from_address, '')), '') IS NOT NULL
ON CONFLICT (user_id, provider_key) DO UPDATE SET
  secret_primary = COALESCE(
    NULLIF(TRIM(EXCLUDED.secret_primary), ''),
    mail_provider_settings.secret_primary
  ),
  options = mail_provider_settings.options || EXCLUDED.options,
  enabled = TRUE,
  updated_at = NOW();

-- Global routing from legacy provider column
INSERT INTO mail_provider_routing (user_id, scope, provider_key, created_at, updated_at)
SELECT
  ms.user_id,
  '*',
  CASE
    WHEN LOWER(COALESCE(ms.provider, '')) = 'resend'
     AND NULLIF(TRIM(COALESCE(ms.resend_api_key, '')), '') IS NOT NULL
      THEN 'resend'
    WHEN NULLIF(TRIM(COALESCE(ms.host, '')), '') IS NOT NULL
      THEN 'smtp'
    WHEN LOWER(COALESCE(ms.provider, '')) = 'resend' THEN 'resend'
    ELSE 'smtp'
  END,
  NOW(),
  NOW()
FROM mail_settings ms
WHERE NULLIF(TRIM(COALESCE(ms.host, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ms.resend_api_key, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ms.from_address, '')), '') IS NOT NULL
ON CONFLICT (user_id, scope) DO NOTHING;
