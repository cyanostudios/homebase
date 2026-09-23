-- 165-pulse-plugin-sms-enabled.sql
-- Per-plugin Pulse SMS enablement (replaces hardcoded routable plugin list).
-- sms_enabled=false (or missing row) → plugin may not send SMS via Pulse.
-- provider_key NULL while sms_enabled=true → inherit global default provider.

ALTER TABLE pulse_provider_routing
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE pulse_provider_routing
  ALTER COLUMN provider_key DROP NOT NULL;

-- Existing override rows were implicitly "Pulse on" for that plugin.
UPDATE pulse_provider_routing
SET sms_enabled = TRUE
WHERE scope <> '*'
  AND sms_enabled = FALSE;

-- Backfill legacy hardcoded routable plugins (pulses, contacts, slots)
-- for every user that already has Pulse provider settings or routing.
INSERT INTO pulse_provider_routing (user_id, scope, provider_key, sms_enabled, created_at, updated_at)
SELECT DISTINCT u.user_id, v.scope, NULL, TRUE, NOW(), NOW()
FROM (
  SELECT user_id FROM pulse_provider_settings
  UNION
  SELECT user_id FROM pulse_provider_routing
) AS u(user_id)
CROSS JOIN (
  VALUES ('pulses'), ('contacts'), ('slots')
) AS v(scope)
ON CONFLICT (user_id, scope) DO UPDATE SET
  sms_enabled = TRUE,
  updated_at = NOW();

-- Global scope is always "on"; keep provider_key required semantically via app validation.
UPDATE pulse_provider_routing
SET sms_enabled = TRUE
WHERE scope = '*';
