-- 020-order-number.sql
-- Persistent order_number per user: assigned on ingest, never reused.

CREATE TABLE IF NOT EXISTS order_number_counter (
  user_id INT PRIMARY KEY,
  next_number BIGINT NOT NULL DEFAULT 1
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number BIGINT;

-- Backfill: assign order_number per user by placed_at (when order was placed on channel), id
-- Oldest orders get lowest numbers, newest orders get highest numbers
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY placed_at ASC NULLS LAST, id ASC) AS rn
  FROM orders
)
UPDATE orders o
SET order_number = r.rn
FROM ranked r
WHERE o.id = r.id AND o.user_id = r.user_id;

-- Initialize counter per user (max + 1)
INSERT INTO order_number_counter (user_id, next_number)
SELECT user_id, COALESCE(MAX(order_number), 0) + 1
FROM orders
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
SET next_number = GREATEST(order_number_counter.next_number, EXCLUDED.next_number);

ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_user_order_number
  ON orders(user_id, order_number);

CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(user_id, order_number);
