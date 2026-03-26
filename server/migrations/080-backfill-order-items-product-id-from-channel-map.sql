-- Backfill order_items.product_id from channel_product_map.external_id for marketplace orders.
-- Aligns Orders item Product-ID with channel mapping semantics used in sync flows.

UPDATE order_items oi
SET product_id = map.product_id::int
FROM orders o, channel_product_map map
WHERE oi.order_id = o.id
  AND o.channel IN ('cdon', 'fyndiq', 'woocommerce')
  AND oi.product_id IS NULL
  AND oi.sku IS NOT NULL
  AND map.user_id = o.user_id
  AND map.channel = o.channel
  AND (map.channel_instance_id IS NOT DISTINCT FROM o.channel_instance_id)
  AND map.external_id = oi.sku
  AND map.product_id ~ '^[0-9]+$';
