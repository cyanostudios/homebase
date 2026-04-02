-- WooCommerce: channel_instances.market stores which textsExtended market (se|dk|fi|no)
-- feeds name/description/meta for that store. Backfill existing rows to Swedish.

UPDATE channel_instances
SET market = 'se'
WHERE channel = 'woocommerce'
  AND (market IS NULL OR TRIM(market) = '');
