-- 128-clubdesk-info-contacts.sql
-- Tenant DB: Clubdesk Info contact list (pick from contacts + short blurb).
-- Presence = published: empty list → no public Hem row / empty page state.

CREATE TABLE IF NOT EXISTS clubdesk_info_contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  blurb VARCHAR(500) NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT clubdesk_info_contacts_user_contact_unique UNIQUE (user_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_clubdesk_info_contacts_user_id
  ON clubdesk_info_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_clubdesk_info_contacts_user_sort
  ON clubdesk_info_contacts (user_id, sort_order ASC, id ASC);
CREATE INDEX IF NOT EXISTS idx_clubdesk_info_contacts_contact_id
  ON clubdesk_info_contacts (contact_id);
