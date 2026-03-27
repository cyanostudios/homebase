-- 051-cups-unique-source-name.sql
-- Prevent duplicate cups from the same source being inserted on re-scrape.
-- The combination (source_id, name) must be unique per tenant.

ALTER TABLE cups
  ADD CONSTRAINT cups_source_id_name_unique UNIQUE (source_id, name);
