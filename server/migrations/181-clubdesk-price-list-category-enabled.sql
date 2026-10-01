-- A price-list category can be turned off without deleting it.
-- Off hides that category's items on the public price list.

ALTER TABLE clubdesk_price_list_item_categories
ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
