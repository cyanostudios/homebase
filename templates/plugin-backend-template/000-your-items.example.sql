-- Example tenant-DB migration for a plugin copied from plugin-backend-template.
-- Copy to server/migrations/NNN-your-items.sql and run against tenant DB (or via scripts/).
-- Replace table/column names to match model.js.

CREATE TABLE IF NOT EXISTS your_items (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_your_items_updated_at ON your_items(updated_at DESC);
