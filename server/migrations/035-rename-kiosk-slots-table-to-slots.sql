-- 035-rename-kiosk-slots-table-to-slots.sql
-- Normalize legacy kiosk naming to slots naming.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'kiosk_slots'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'slots'
  ) THEN
    ALTER TABLE kiosk_slots RENAME TO slots;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_kiosk_slots_user_id')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_slots_user_id') THEN
    ALTER INDEX idx_kiosk_slots_user_id RENAME TO idx_slots_user_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_kiosk_slots_slot_time')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_slots_slot_time') THEN
    ALTER INDEX idx_kiosk_slots_slot_time RENAME TO idx_slots_slot_time;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_kiosk_slots_created_at')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_slots_created_at') THEN
    ALTER INDEX idx_kiosk_slots_created_at RENAME TO idx_slots_created_at;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_kiosk_slots_contact_id')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_slots_contact_id') THEN
    ALTER INDEX idx_kiosk_slots_contact_id RENAME TO idx_slots_contact_id;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_kiosk_slots_match_id')
     AND NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'idx_slots_match_id') THEN
    ALTER INDEX idx_kiosk_slots_match_id RENAME TO idx_slots_match_id;
  END IF;
END $$;
