-- 160-file-attachments-unique.sql
-- Prevent duplicate links of the same file to the same plugin entity per user

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_attachments_user_plugin_entity_file
  ON file_attachments (user_id, plugin_name, entity_id, file_id);
