-- Drop FK on parent_product_id so we can store Sello parent id even when parent
-- product is not yet imported (variant imported before parent, or variant alone).
-- Export to Fyndiq/CDON needs correct parent_sku (parent's id), not group_id.

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_parent_product_id_fkey;
