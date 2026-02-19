-- Pulse (SMS) plugin: per-user settings and send log (idempotent)
CREATE TABLE IF NOT EXISTS pulse_settings (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  active_provider VARCHAR(50) DEFAULT 'twilio',
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_from_number VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pulse_log (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  recipient VARCHAR(100) NOT NULL,
  body TEXT,
  provider VARCHAR(50),
  status VARCHAR(50),
  sent_at TIMESTAMP DEFAULT NOW(),
  plugin_source VARCHAR(100),
  reference_id VARCHAR(100)
);
