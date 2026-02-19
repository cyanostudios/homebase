-- 034-kiosk-slots-add-match-id.sql
-- Link slot to match when created via "To slot" from a match (show in information panel)

ALTER TABLE kiosk_slots
  ADD COLUMN IF NOT EXISTS match_id INT REFERENCES matches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kiosk_slots_match_id ON kiosk_slots(match_id);
