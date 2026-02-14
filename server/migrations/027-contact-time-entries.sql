-- 027-contact-time-entries.sql
-- Time entries linked to contacts (for time tracking widget)

CREATE TABLE IF NOT EXISTS contact_time_entries (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  contact_id INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  seconds INT NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contact_time_entries_contact_id ON contact_time_entries(contact_id);
CREATE INDEX idx_contact_time_entries_contact_logged ON contact_time_entries(contact_id, logged_at DESC);
CREATE INDEX idx_contact_time_entries_user_id ON contact_time_entries(user_id);
