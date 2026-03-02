-- 055-orders-channel-label.sql
-- Store WooCommerce store display name on order so it survives store removal.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS channel_label VARCHAR(255) NULL;
