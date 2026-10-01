-- 177-clubdesk-inventory-clear-featured.sql
-- Inventory is not featured on the public Hem. Guides and price lists keep featured.

UPDATE clubdesk_inventory_items
SET featured = FALSE
WHERE featured IS DISTINCT FROM FALSE;
