-- 030-kiosk-add-contact.sql
-- Add contact link and mentions to kiosk_slots (Tasks-style)

ALTER TABLE kiosk_slots
  ADD COLUMN IF NOT EXISTS contact_id INT REFERENCES contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS mentions JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_kiosk_slots_contact_id ON kiosk_slots(contact_id);
