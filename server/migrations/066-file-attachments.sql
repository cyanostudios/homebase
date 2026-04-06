-- 066-file-attachments.sql
-- Link user_files rows to arbitrary plugin entities (notes, contacts, …)

CREATE TABLE IF NOT EXISTS file_attachments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  file_id INT NOT NULL REFERENCES user_files(id) ON DELETE CASCADE,
  plugin_name VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_attachments_plugin_entity ON file_attachments(plugin_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_attachments_file_id ON file_attachments(file_id);
