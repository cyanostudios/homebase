-- 022-woocommerce-instances.sql
-- Migrate WooCommerce settings to channel_instances for multi-store support

-- Ensure columns exist (they were never added in 017; only channel_product_overrides got channel_instance_id)
ALTER TABLE channel_product_map ADD COLUMN IF NOT EXISTS channel_instance_id INT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel_instance_id INT;

-- Migrate existing WooCommerce settings to channel_instances
INSERT INTO channel_instances (user_id, channel, instance_key, market, label, credentials, created_at, updated_at)
SELECT
  user_id,
  'woocommerce' AS channel,
  'default' AS instance_key,
  NULL AS market,
  COALESCE(
    CASE 
      WHEN store_url LIKE '%://%' THEN 
        SUBSTRING(store_url FROM 'https?://([^/]+)')
      ELSE store_url
    END,
    'WooCommerce Store'
  ) AS label,
  jsonb_build_object(
    'storeUrl', store_url,
    'consumerKey', consumer_key,
    'consumerSecret', consumer_secret,
    'useQueryAuth', COALESCE(use_query_auth, false)
  ) AS credentials,
  created_at,
  updated_at
FROM woocommerce_settings
WHERE NOT EXISTS (
  SELECT 1 FROM channel_instances ci
  WHERE ci.user_id = woocommerce_settings.user_id
    AND ci.channel = 'woocommerce'
    AND ci.instance_key = 'default'
);

-- Update channel_product_map to reference instances where applicable
-- (This is for backwards compatibility - new exports will use channel_instance_id)
UPDATE channel_product_map cm
SET channel_instance_id = ci.id
FROM channel_instances ci
WHERE cm.user_id = ci.user_id
  AND cm.channel = ci.channel
  AND ci.channel = 'woocommerce'
  AND ci.instance_key = 'default'
  AND (cm.channel_instance_id IS NULL OR cm.channel_instance_id = 0);

-- Update orders table to reference instances where applicable
UPDATE orders o
SET channel_instance_id = ci.id
FROM channel_instances ci
WHERE o.user_id = ci.user_id
  AND o.channel = ci.channel
  AND ci.channel = 'woocommerce'
  AND ci.instance_key = 'default'
  AND (o.channel_instance_id IS NULL OR o.channel_instance_id = 0);
