-- 022-woocommerce-instances.sql
-- Legacy migration kept for compatibility with run-all-migrations.
-- IMPORTANT: never create a Woo instance with instance_key = 'default'.

-- Ensure columns exist
ALTER TABLE channel_product_map ADD COLUMN IF NOT EXISTS channel_instance_id INT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel_instance_id INT;

-- Migrate legacy woocommerce_settings to channel_instances only when the user
-- has no Woo instances yet. Use a deterministic key from store_url host
-- instead of the banned "default" key.
WITH legacy AS (
  SELECT
    ws.user_id,
    ws.store_url,
    ws.consumer_key,
    ws.consumer_secret,
    ws.use_query_auth,
    ws.created_at,
    ws.updated_at,
    lower(
      regexp_replace(
        trim(both '/' from regexp_replace(coalesce(ws.store_url, ''), '^https?://', '', 'i')),
        '[^a-z0-9]+',
        '-',
        'g'
      )
    ) AS generated_instance_key,
    nullif(
      regexp_replace(
        trim(both '/' from regexp_replace(coalesce(ws.store_url, ''), '^https?://', '', 'i')),
        '/.*$',
        ''
      ),
      ''
    ) AS generated_label
  FROM woocommerce_settings ws
),
to_insert AS (
  SELECT l.*
  FROM legacy l
  WHERE l.generated_instance_key <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM channel_instances ci
      WHERE ci.user_id = l.user_id
        AND ci.channel = 'woocommerce'
    )
)
INSERT INTO channel_instances (user_id, channel, instance_key, market, label, credentials, created_at, updated_at)
SELECT
  t.user_id,
  'woocommerce' AS channel,
  t.generated_instance_key AS instance_key,
  NULL AS market,
  t.generated_label AS label,
  jsonb_build_object(
    'storeUrl', t.store_url,
    'consumerKey', t.consumer_key,
    'consumerSecret', t.consumer_secret,
    'useQueryAuth', COALESCE(t.use_query_auth, false)
  ) AS credentials,
  t.created_at,
  t.updated_at
FROM to_insert t
ON CONFLICT (user_id, channel, instance_key) DO NOTHING;
