-- 174-clubdesk-site-content-inventory-card.sql
-- Tenant DB: allow inventory card_key (public tab visibility meta) + default inventory published.

ALTER TABLE clubdesk_site_content
  DROP CONSTRAINT IF EXISTS clubdesk_site_content_card_key_check;

ALTER TABLE clubdesk_site_content
  ADD CONSTRAINT clubdesk_site_content_card_key_check
  CHECK (card_key IN ('home', 'info', 'contacts', 'swish', 'inventory'));

-- New articles and existing catalog rows are public by default when inventory tables exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = 'clubdesk_inventory_items'
  ) THEN
    ALTER TABLE clubdesk_inventory_items
      ALTER COLUMN publication_status SET DEFAULT 'published';

    UPDATE clubdesk_inventory_items
    SET publication_status = 'published'
    WHERE publication_status = 'draft';
  END IF;
END $$;
