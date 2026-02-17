-- 029-kiosk.sql
-- Kiosk slots: location, slot_time, capacity (1-5), visible, notifications_enabled

CREATE TABLE IF NOT EXISTS kiosk_slots (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  location VARCHAR(255),
  slot_time TIMESTAMP NOT NULL,
  capacity SMALLINT NOT NULL CHECK (capacity >= 1 AND capacity <= 5),
  visible BOOLEAN DEFAULT true,
  notifications_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kiosk_slots_user_id ON kiosk_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_kiosk_slots_slot_time ON kiosk_slots(slot_time);
CREATE INDEX IF NOT EXISTS idx_kiosk_slots_created_at ON kiosk_slots(created_at);
