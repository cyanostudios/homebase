-- Add MVP fields for products. Non-breaking: keep old columns for now.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_number   VARCHAR(50),
  ADD COLUMN IF NOT EXISTS sku              VARCHAR(64),
  ADD COLUMN IF NOT EXISTS title            VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS status           VARCHAR(16),
  ADD COLUMN IF NOT EXISTS quantity         INTEGER,
  ADD COLUMN IF NOT EXISTS price_amount     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS currency         VARCHAR(3),
  ADD COLUMN IF NOT EXISTS vat_rate         NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS main_image       VARCHAR(1500),
  ADD COLUMN IF NOT EXISTS images           JSONB,
  ADD COLUMN IF NOT EXISTS categories       JSONB,
  ADD COLUMN IF NOT EXISTS brand            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gtin             VARCHAR(14);

-- Initialize sensible defaults and backfill from old fields
UPDATE public.products
SET
  product_number = COALESCE(product_number, contact_number),
  title          = COALESCE(title, company_name),
  status         = COALESCE(status, 'for sale'),
  quantity       = COALESCE(quantity, 0),
  price_amount   = COALESCE(price_amount, 0),
  currency       = COALESCE(currency, 'SEK'),
  vat_rate       = COALESCE(vat_rate, 25),
  images         = COALESCE(images, '[]'::jsonb),
  categories     = COALESCE(categories, '[]'::jsonb);

-- Enforce NOT NULL where safe (after backfill)
ALTER TABLE public.products
  ALTER COLUMN status       SET NOT NULL,
  ALTER COLUMN quantity     SET NOT NULL,
  ALTER COLUMN price_amount SET NOT NULL,
  ALTER COLUMN currency     SET NOT NULL,
  ALTER COLUMN vat_rate     SET NOT NULL,
  ALTER COLUMN images       SET NOT NULL,
  ALTER COLUMN categories   SET NOT NULL;

-- Helpful unique index for product_number per user
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_user_product_number
  ON public.products(user_id, product_number)
  WHERE product_number IS NOT NULL;

