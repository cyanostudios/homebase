-- 100-ai-provider-settings.sql
-- Tenant-scoped settings for external AI providers (v1: OpenAI)

CREATE TABLE IF NOT EXISTS ai_provider_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  provider_key VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  api_key TEXT,
  default_model VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_settings_user_id
  ON ai_provider_settings(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_provider_settings_provider_key
  ON ai_provider_settings(provider_key);
