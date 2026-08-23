-- 143-garment-list-persons-contact-id.sql
-- Link garment list persons to Contacts (nullable FK).

ALTER TABLE garment_list_persons
  ADD COLUMN IF NOT EXISTS contact_id INTEGER NULL REFERENCES contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_garment_list_persons_contact
  ON garment_list_persons(contact_id)
  WHERE contact_id IS NOT NULL;
