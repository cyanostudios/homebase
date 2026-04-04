-- 065-user-files-storage-provider.sql
-- Track which storage provider holds file bytes and external id for cloud objects

ALTER TABLE user_files ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32) NOT NULL DEFAULT 'local';
ALTER TABLE user_files ADD COLUMN IF NOT EXISTS external_file_id TEXT;

CREATE INDEX IF NOT EXISTS idx_user_files_storage_provider ON user_files(storage_provider);
