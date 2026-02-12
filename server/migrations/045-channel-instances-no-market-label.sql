-- 045-channel-instances-no-market-label.sql
-- Backfill market and label for Norway (NO) per CDON/Fyndiq API documentation.
-- CDON: Supported Market Codes — NO | Norway (ISO-3166-1 alpha-2).
-- Fyndiq: SE, DK, FI and NO (Norway) supported.

UPDATE channel_instances
SET market = 'no', label = 'Norway', updated_at = CURRENT_TIMESTAMP
WHERE channel IN ('cdon', 'fyndiq')
  AND lower(instance_key) = 'no'
  AND (market IS NULL OR label IS NULL);
