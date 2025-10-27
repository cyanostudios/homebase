-- 2025-10-27_invoices_hardening.sql
-- Idempotent härdning av Invoices-schema + shares
-- Körbar flera gånger utan att förstöra data

BEGIN;

-- === status_changed_at -> timestamptz NOT NULL DEFAULT now() ===============
DO $$
DECLARE t text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'invoices'
    AND a.attname = 'status_changed_at'
    AND a.attnum > 0;

  IF t IS NULL THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
      ADD COLUMN status_changed_at timestamptz NOT NULL DEFAULT now()
    $cmd$;

  ELSIF t = 'timestamp with time zone' THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN status_changed_at SET NOT NULL,
        ALTER COLUMN status_changed_at SET DEFAULT now()
    $cmd$;

  ELSIF t = 'timestamp without time zone' THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN status_changed_at TYPE timestamptz USING status_changed_at::timestamptz,
        ALTER COLUMN status_changed_at SET NOT NULL,
        ALTER COLUMN status_changed_at SET DEFAULT now()
    $cmd$;

  ELSIF t IN ('integer','bigint','numeric','double precision') THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN status_changed_at TYPE timestamptz
        USING to_timestamp((status_changed_at)::double precision / 1000.0),
        ALTER COLUMN status_changed_at SET NOT NULL,
        ALTER COLUMN status_changed_at SET DEFAULT now()
    $cmd$;

  ELSIF t IN ('text','character varying','bpchar') THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN status_changed_at TYPE timestamptz
        USING CASE
          WHEN NULLIF((status_changed_at)::text,'') IS NULL THEN now()
          ELSE to_timestamp((NULLIF((status_changed_at)::text,''))::double precision / 1000.0)
        END,
        ALTER COLUMN status_changed_at SET NOT NULL,
        ALTER COLUMN status_changed_at SET DEFAULT now()
    $cmd$;

  ELSE
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN status_changed_at TYPE timestamptz USING now(),
        ALTER COLUMN status_changed_at SET NOT NULL,
        ALTER COLUMN status_changed_at SET DEFAULT now()
    $cmd$;
  END IF;
END $$;

-- === paid_at -> timestamptz NULL (ingen default) ============================
DO $$
DECLARE t text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'invoices'
    AND a.attname = 'paid_at'
    AND a.attnum > 0;

  IF t IS NULL THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ADD COLUMN paid_at timestamptz
    $cmd$;

  ELSIF t = 'timestamp with time zone' THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN paid_at DROP NOT NULL,
        ALTER COLUMN paid_at DROP DEFAULT
    $cmd$;

  ELSIF t = 'timestamp without time zone' THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN paid_at TYPE timestamptz USING paid_at::timestamptz,
        ALTER COLUMN paid_at DROP NOT NULL,
        ALTER COLUMN paid_at DROP DEFAULT
    $cmd$;

  ELSIF t IN ('integer','bigint','numeric','double precision') THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN paid_at TYPE timestamptz
        USING CASE
          WHEN paid_at IS NULL THEN NULL
          ELSE to_timestamp((paid_at)::double precision / 1000.0)
        END,
        ALTER COLUMN paid_at DROP NOT NULL,
        ALTER COLUMN paid_at DROP DEFAULT
    $cmd$;

  ELSIF t IN ('text','character varying','bpchar') THEN
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN paid_at TYPE timestamptz
        USING CASE
          WHEN NULLIF((paid_at)::text,'') IS NULL THEN NULL
          ELSE to_timestamp((NULLIF((paid_at)::text,''))::double precision / 1000.0)
        END,
        ALTER COLUMN paid_at DROP NOT NULL,
        ALTER COLUMN paid_at DROP DEFAULT
    $cmd$;

  ELSE
    EXECUTE $cmd$
      ALTER TABLE public.invoices
        ALTER COLUMN paid_at TYPE timestamptz USING NULL,
        ALTER COLUMN paid_at DROP NOT NULL,
        ALTER COLUMN paid_at DROP DEFAULT
    $cmd$;
  END IF;
END $$;

-- === Totals -> numeric(12,2) NOT NULL DEFAULT 0 =============================
DO $$
DECLARE col text;
BEGIN
  FOR col IN
    SELECT unnest(ARRAY[
      'subtotal',
      'total_discount',
      'subtotal_after_discount',
      'invoice_discount_amount',
      'subtotal_after_invoice_discount',
      'total_vat',
      'total'
    ])
  LOOP
    EXECUTE format($f$
      ALTER TABLE public.invoices
        ALTER COLUMN %1$I TYPE numeric(12,2)
        USING
          CASE
            WHEN %1$I IS NULL THEN 0
            WHEN pg_typeof(%1$I)::text LIKE 'timestamp%%' THEN 0
            WHEN pg_typeof(%1$I)::text IN ('text','varchar','bpchar') THEN
              CASE
                WHEN btrim((%1$I)::text) ~ '^-?\d+(\.\d+)?$' THEN (btrim((%1$I)::text))::numeric
                ELSE 0
              END
            ELSE %1$I::numeric
          END,
        ALTER COLUMN %1$I SET DEFAULT 0,
        ALTER COLUMN %1$I SET NOT NULL
    $f$, col);
  END LOOP;
END $$;

-- === line_items -> jsonb NOT NULL DEFAULT '[]' ===============================
ALTER TABLE public.invoices
  ALTER COLUMN line_items TYPE jsonb USING
    CASE
      WHEN line_items IS NULL THEN '[]'::jsonb
      WHEN pg_typeof(line_items)::text IN ('json','jsonb') THEN line_items::jsonb
      WHEN pg_typeof(line_items)::text IN ('text','varchar','bpchar') THEN
        CASE
          WHEN btrim((line_items)::text) = '' THEN '[]'::jsonb
          ELSE (line_items::jsonb)
        END
      ELSE '[]'::jsonb
    END,
  ALTER COLUMN line_items SET DEFAULT '[]'::jsonb,
  ALTER COLUMN line_items SET NOT NULL;

-- === invoice_shares (offentliga länkar) =====================================
CREATE TABLE IF NOT EXISTS public.invoice_shares (
  id               bigserial PRIMARY KEY,
  user_id          bigint NOT NULL,
  invoice_id       bigint NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  share_token      text NOT NULL UNIQUE,
  valid_until      timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  accessed_count   int NOT NULL DEFAULT 0,
  last_accessed_at timestamptz
);

-- Hjälpindex (skapas bara om de saknas med samma namn)
CREATE INDEX IF NOT EXISTS invoices_user_id_status_idx ON public.invoices(user_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_shares_invoice_id ON public.invoice_shares(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_shares_token_idx ON public.invoice_shares(share_token);

COMMIT;

-- === Verifiering (frivillig) ================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='invoices'
-- ORDER BY ordinal_position;
