-- 029-woocommerce-dedupe-instances.sql
-- Remove duplicate WooCommerce instances: 022 inserted 'default' from woocommerce_settings
-- while the same store may already exist with a custom instance_key (e.g. merchbutiken-se).
-- Keep the non-default instance, delete the redundant 'default' one when store URL matches.

DELETE FROM channel_instances a
USING channel_instances b
WHERE a.channel = 'woocommerce'
  AND b.channel = 'woocommerce'
  AND a.instance_key = 'default'
  AND b.instance_key != 'default'
  AND a.user_id = b.user_id
  AND a.id != b.id
  AND lower(trim(both '/' from regexp_replace(coalesce(a.credentials->>'storeUrl', ''), '^https?://', '', 'i')))
    = lower(trim(both '/' from regexp_replace(coalesce(b.credentials->>'storeUrl', ''), '^https?://', '', 'i')));
