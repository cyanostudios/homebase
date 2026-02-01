-- WARNING: Run only when frontend/backend no longer reference legacy columns!
ALTER TABLE public.products
  DROP COLUMN IF EXISTS contact_number,
  DROP COLUMN IF EXISTS contact_type,
  DROP COLUMN IF EXISTS company_name,
  DROP COLUMN IF EXISTS company_type,
  DROP COLUMN IF EXISTS organization_number,
  DROP COLUMN IF EXISTS vat_number,
  DROP COLUMN IF EXISTS personal_number,
  DROP COLUMN IF EXISTS contact_persons,
  DROP COLUMN IF EXISTS addresses,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS phone2,
  DROP COLUMN IF EXISTS website,
  DROP COLUMN IF EXISTS tax_rate,
  DROP COLUMN IF EXISTS payment_terms,
  DROP COLUMN IF EXISTS f_tax,
  DROP COLUMN IF EXISTS notes;

-- Unique indexes (final form)
CREATE UNIQUE INDEX IF NOT EXISTS ux_products_user_sku
  ON public.products(user_id, sku) WHERE sku IS NOT NULL;
