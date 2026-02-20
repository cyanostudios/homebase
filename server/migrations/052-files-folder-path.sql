-- 052-files-folder-path.sql
-- Add folder_path to user_files for physical folder structure.
-- folder_path: relative path like 'Mapp A' or 'Mapp A/Undermapp'; null = root.

ALTER TABLE user_files ADD COLUMN IF NOT EXISTS folder_path VARCHAR(500);
CREATE INDEX IF NOT EXISTS idx_user_files_folder_path ON user_files(folder_path);
