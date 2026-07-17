-- 101-ai-provider-routing.sql
-- Per-user AI provider routing: global default + optional per-plugin overrides

CREATE TABLE IF NOT EXISTS ai_provider_routing (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  scope VARCHAR(100) NOT NULL,
  provider_key VARCHAR(50) NOT NULL,
  model VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scope)
);

CREATE INDEX IF NOT EXISTS idx_ai_provider_routing_user_id
  ON ai_provider_routing(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_provider_routing_scope
  ON ai_provider_routing(scope);
