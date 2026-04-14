-- Trim existing product_stock_events to max 50 rows per product (matches runtime policy).

DELETE FROM product_stock_events
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY product_id
             ORDER BY created_at DESC, id DESC
           ) AS rn
    FROM product_stock_events
  ) ranked
  WHERE rn > 50
);
