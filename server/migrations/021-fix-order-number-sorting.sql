-- 021-fix-order-number-sorting.sql
-- Fix order_number assignment: use placed_at instead of created_at
-- Oldest orders (by placed_at) should get lowest numbers, newest get highest

-- Step 1: Temporarily drop the NOT NULL constraint and unique index
ALTER TABLE orders ALTER COLUMN order_number DROP NOT NULL;
DROP INDEX IF EXISTS ux_orders_user_order_number;

-- Step 2: Re-assign order_number based on placed_at (not created_at)
WITH ranked AS (
  SELECT id, user_id,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY placed_at ASC NULLS LAST, id ASC) AS rn
  FROM orders
)
UPDATE orders o
SET order_number = r.rn
FROM ranked r
WHERE o.id = r.id AND o.user_id = r.user_id;

-- Step 3: Restore NOT NULL constraint
ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;

-- Step 4: Recreate unique index
CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_user_order_number
  ON orders(user_id, order_number);

-- Step 5: Reset counter to max(order_number) + 1 per user
INSERT INTO order_number_counter (user_id, next_number)
SELECT user_id, COALESCE(MAX(order_number), 0) + 1
FROM orders
GROUP BY user_id
ON CONFLICT (user_id) DO UPDATE
SET next_number = GREATEST(
  order_number_counter.next_number,
  EXCLUDED.next_number
);
