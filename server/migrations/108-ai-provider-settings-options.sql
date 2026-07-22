-- 108-ai-provider-settings-options.sql
-- Provider-specific settings (e.g. ElevenLabs voiceId) as JSON

ALTER TABLE ai_provider_settings
  ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;
