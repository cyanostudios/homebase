-- Price lists can hide category headings without deleting the category catalog.

ALTER TABLE clubdesk_price_lists
ADD COLUMN IF NOT EXISTS categories_enabled BOOLEAN NOT NULL DEFAULT TRUE;
