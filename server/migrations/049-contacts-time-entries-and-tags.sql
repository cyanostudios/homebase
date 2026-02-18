-- 049-contacts-time-entries-and-tags.sql
-- Contact time entries (time tracking) and tags/is_assignable for 3.X parity.
-- Run in tenant schema (search_path set by provider).

-- Contacts: tags and is_assignable (3.X ContactView, ContactForm)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_assignable BOOLEAN DEFAULT true;

-- Contact time entries (per-contact time tracking)
CREATE TABLE IF NOT EXISTS contact_time_entries (
  id SERIAL PRIMARY KEY,
  contact_id INT NOT NULL,
  user_id INT NOT NULL,
  seconds INT NOT NULL,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_time_entries_contact_id ON contact_time_entries(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_time_entries_user_id ON contact_time_entries(user_id);
