-- Main database only: maps opaque share tokens to tenant connection strings so
-- GET /api/tasks/public/:token and GET /api/notes/public/:token work without a session.

CREATE TABLE IF NOT EXISTS public_share_routing (
  share_token VARCHAR(128) PRIMARY KEY,
  resource_type VARCHAR(16) NOT NULL CHECK (resource_type IN ('task', 'note')),
  tenant_connection_string TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_share_routing_resource
  ON public_share_routing (resource_type);
