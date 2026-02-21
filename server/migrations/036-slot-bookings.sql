-- 036-slot-bookings.sql
-- Public booking system: external bookings for slots and in-app notifications

-- Bookings from public app
CREATE TABLE IF NOT EXISTS slot_bookings (
  id SERIAL PRIMARY KEY,
  slot_id INT NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(100),
  message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slot_bookings_slot_id ON slot_bookings(slot_id);

-- In-app notifications for admins
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  reference_id INT,
  reference_type VARCHAR(100),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
