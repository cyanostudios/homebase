-- 023-mail-log.sql
-- Mail log table for tracking sent emails

CREATE TABLE IF NOT EXISTS mail_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  recipients TEXT NOT NULL,
  subject VARCHAR(500),
  sent_at TIMESTAMP DEFAULT NOW(),
  plugin_source VARCHAR(100),
  reference_id VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mail_log_user_id ON mail_log(user_id);
CREATE INDEX idx_mail_log_sent_at ON mail_log(sent_at);
CREATE INDEX idx_mail_log_plugin_source ON mail_log(plugin_source);
CREATE INDEX idx_mail_log_reference_id ON mail_log(reference_id);
