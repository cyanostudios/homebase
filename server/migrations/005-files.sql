-- 005-files.sql
-- Files table for file metadata management

CREATE TABLE IF NOT EXISTS user_files (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  size BIGINT,
  mime_type VARCHAR(255),
  url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_files_user_id ON user_files(user_id);
CREATE INDEX idx_user_files_name ON user_files(name);
CREATE INDEX idx_user_files_mime_type ON user_files(mime_type);
CREATE INDEX idx_user_files_created_at ON user_files(created_at);
CREATE INDEX idx_user_files_updated_at ON user_files(updated_at);