-- 046-channel-instances-se-market-label.sql
-- Backfill market and label for Sweden (SE) per CDON/Fyndiq API documentation.
-- For rows where these were cleared (e.g. by toggling enabled before the updateInstance fix).

UPDATE channel_instances
SET market = 'se', label = 'Sweden', updated_at = CURRENT_TIMESTAMP
WHERE channel IN ('cdon', 'fyndiq')
  AND lower(instance_key) = 'se'
  AND (market IS NULL OR label IS NULL);
