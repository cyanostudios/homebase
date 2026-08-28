-- 154-garment-list-persons-ct-audiences.sql
-- Per-person audience pick per assigned inventory item.

ALTER TABLE garment_list_persons
  ADD COLUMN IF NOT EXISTS ct_audiences JSONB NOT NULL DEFAULT '{}'::jsonb;
