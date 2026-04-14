-- Hidden draft products used to reserve a real product id before first save.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_products_is_draft_true
  ON products(is_draft)
  WHERE is_draft = TRUE;
