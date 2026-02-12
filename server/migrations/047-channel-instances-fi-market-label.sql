-- 047-channel-instances-fi-market-label.sql
-- Backfill market and label for Finland (FI) per CDON/Fyndiq API documentation.
-- For rows where these were cleared (e.g. by toggling enabled before the updateInstance fix).

UPDATE channel_instances
SET market = 'fi', label = 'Finland', updated_at = CURRENT_TIMESTAMP
WHERE channel IN ('cdon', 'fyndiq')
  AND lower(instance_key) = 'fi'
  AND (market IS NULL OR label IS NULL);
