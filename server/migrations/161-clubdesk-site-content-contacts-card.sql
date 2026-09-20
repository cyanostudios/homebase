-- 161-clubdesk-site-content-contacts-card.sql
-- Tenant DB: allow contacts card_key on clubdesk_site_content (visibility meta).
-- 122 only allowed home/info/swish; Info save upserts contacts and failed the CHECK.

ALTER TABLE clubdesk_site_content
  DROP CONSTRAINT IF EXISTS clubdesk_site_content_card_key_check;

ALTER TABLE clubdesk_site_content
  ADD CONSTRAINT clubdesk_site_content_card_key_check
  CHECK (card_key IN ('home', 'info', 'contacts', 'swish'));
