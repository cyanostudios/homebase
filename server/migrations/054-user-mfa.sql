-- 054-user-mfa.sql
-- Two-factor authentication (TOTP) per user. Main pool, public schema.

CREATE TABLE IF NOT EXISTS user_mfa (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  secret_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_mfa_user_id ON user_mfa(user_id);
