-- 085-products-status-for-sale-paused.sql
-- Product status is only 'for sale' | 'paused'.

UPDATE products
SET status = 'for sale'
WHERE status IS NULL
  OR TRIM(status) = ''
  OR LOWER(TRIM(status)) NOT IN ('for sale', 'paused');
