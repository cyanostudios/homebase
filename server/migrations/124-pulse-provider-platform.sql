-- 124-pulse-provider-platform.sql
-- Multi-provider settings + routing for Pulse (SMS), mirroring AI Providers pattern.
-- Backfills from legacy pulse_settings. Runtime should use new tables only.

CREATE TABLE IF NOT EXISTS pulse_provider_settings (
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

CREATE INDEX IF NOT EXISTS idx_pulse_provider_settings_user_id
  ON pulse_provider_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_pulse_provider_settings_provider_key
  ON pulse_provider_settings(provider_key);

CREATE TABLE IF NOT EXISTS pulse_provider_routing (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  scope VARCHAR(100) NOT NULL,
  provider_key VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_pulse_provider_routing_user_id
  ON pulse_provider_routing(user_id);

CREATE INDEX IF NOT EXISTS idx_pulse_provider_routing_scope
  ON pulse_provider_routing(scope);

-- Backfill from legacy pulse_settings (idempotent via ON CONFLICT)
INSERT INTO pulse_provider_settings (
  user_id, provider_key, enabled, secret_primary, secret_secondary, options, created_at, updated_at
)
SELECT
  ps.user_id,
  'twilio',
  TRUE,
  NULLIF(TRIM(ps.twilio_account_sid), ''),
  NULLIF(TRIM(ps.twilio_auth_token), ''),
  jsonb_strip_nulls(
    jsonb_build_object(
      'fromNumber',
      NULLIF(TRIM(COALESCE(ps.twilio_from_number, '')), '')
    )
  ),
  COALESCE(ps.created_at, NOW()),
  COALESCE(ps.updated_at, NOW())
FROM pulse_settings ps
WHERE NULLIF(TRIM(COALESCE(ps.twilio_account_sid, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ps.twilio_auth_token, '')), '') IS NOT NULL
   OR NULLIF(TRIM(COALESCE(ps.twilio_from_number, '')), '') IS NOT NULL
ON CONFLICT (user_id, provider_key) DO UPDATE SET
  secret_primary = COALESCE(
    NULLIF(TRIM(EXCLUDED.secret_primary), ''),
    pulse_provider_settings.secret_primary
  ),
  secret_secondary = COALESCE(
    NULLIF(TRIM(EXCLUDED.secret_secondary), ''),
    pulse_provider_settings.secret_secondary
  ),
  options = CASE
    WHEN EXCLUDED.options ? 'fromNumber' THEN
      pulse_provider_settings.options || EXCLUDED.options
    ELSE pulse_provider_settings.options
  END,
  enabled = TRUE,
  updated_at = NOW();

-- Ensure mock catalog row for every user that had legacy settings (or any settings user)
INSERT INTO pulse_provider_settings (
  user_id, provider_key, enabled, secret_primary, secret_secondary, options, created_at, updated_at
)
SELECT DISTINCT
  ps.user_id,
  'mock',
  TRUE,
  NULL,
  NULL,
  '{}'::jsonb,
  NOW(),
  NOW()
FROM pulse_settings ps
ON CONFLICT (user_id, provider_key) DO UPDATE SET
  enabled = TRUE,
  updated_at = NOW();

-- Global routing from active_provider
INSERT INTO pulse_provider_routing (user_id, scope, provider_key, created_at, updated_at)
SELECT
  ps.user_id,
  '*',
  CASE
    WHEN LOWER(COALESCE(ps.active_provider, '')) IN ('mock', 'apple-messages') THEN 'mock'
    WHEN NULLIF(TRIM(COALESCE(ps.twilio_account_sid, '')), '') IS NOT NULL
     AND NULLIF(TRIM(COALESCE(ps.twilio_auth_token, '')), '') IS NOT NULL
     AND NULLIF(TRIM(COALESCE(ps.twilio_from_number, '')), '') IS NOT NULL
      THEN 'twilio'
    WHEN LOWER(COALESCE(ps.active_provider, '')) = 'twilio' THEN 'twilio'
    ELSE 'mock'
  END,
  NOW(),
  NOW()
FROM pulse_settings ps
ON CONFLICT (user_id, scope) DO NOTHING;
