-- 096-orders-staff-note.sql
-- Internal staff-only note per order (UI: lazy-loaded; not touched by channel sync).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS staff_note TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS chk_orders_staff_note_len;

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_staff_note_len
  CHECK (staff_note IS NULL OR char_length(staff_note) <= 2000);
