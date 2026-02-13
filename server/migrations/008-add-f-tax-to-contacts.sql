-- 008-add-f-tax-to-contacts.sql
-- Add f_tax column to contacts table (used by contacts plugin model)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'contacts'
      AND column_name = 'f_tax'
  ) THEN
    ALTER TABLE contacts ADD COLUMN f_tax VARCHAR(10);
  END IF;
END $$;
