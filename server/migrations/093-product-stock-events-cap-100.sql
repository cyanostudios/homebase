-- Raise retention cap to 100 rows per product (matches ProductModel.MAX_STOCK_EVENTS_PER_PRODUCT).

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
  WHERE rn > 100
);
