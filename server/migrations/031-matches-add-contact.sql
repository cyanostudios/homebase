-- 031-matches-add-contact.sql
-- Add contact link and mentions to matches (same pattern as kiosk)

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS contact_id INT REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_matches_contact_id ON matches(contact_id);
