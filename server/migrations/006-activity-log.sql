-- 006-activity-log.sql
-- Activity log table for audit trail per tenant

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'export', 'settings'
  entity_type VARCHAR(50) NOT NULL, -- 'contact', 'note', 'task', 'estimate', 'invoice', 'file', 'settings'
  entity_id INT, -- ID of the affected entity (NULL for bulk operations)
  entity_name VARCHAR(255), -- Human-readable name (e.g., "Acme Corp" for contact)
  metadata JSONB, -- Flexible storage for additional data (IP, user agent, changes, etc.)
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_type ON activity_log(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_id ON activity_log(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_activity_log_user_entity ON activity_log(user_id, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity_lookup ON activity_log(entity_type, entity_id, created_at DESC);

-- Index for JSONB metadata queries (if needed)
CREATE INDEX IF NOT EXISTS idx_activity_log_metadata_gin ON activity_log USING GIN (metadata);
