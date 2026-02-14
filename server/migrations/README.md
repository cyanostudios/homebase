# Migrations

## 027-contact-time-entries.sql

Skapar tabellen `contact_time_entries` (time tracking mot contacts).

**Kör på alla tenants:**

```bash
npm run migrate:contact-time-entries
```

Kräver `DATABASE_URL` (och vid Neon: tenants med `neon_connection_string` i `tenants`). Vid lokalt schema-per-tenant: `TENANT_PROVIDER=local`.

**Manuellt (en databas):** Öppna SQL-editor (t.ex. Neon Console), klistra in innehållet i `027-contact-time-entries.sql` och kör. Idempotent (`CREATE TABLE IF NOT EXISTS`).

---

## Invoices hardening migration (2025-10-27)

### Files

- `2025-10-27_invoices_hardening.sql` — idempotent. Säkra typer/timestamps/totals/line_items + invoice_shares + index.

### How to run (Neon Console)

1. Öppna Neon → SQL editor.
2. Klistra in hela filens innehåll och kör.
3. Ingen output = OK (idempotent).

## Verify

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='invoices'
  AND column_name IN (
    'status_changed_at','paid_at',
    'subtotal','total_discount','subtotal_after_discount',
    'invoice_discount_amount','subtotal_after_invoice_discount',
    'total_vat','total','line_items'
  )
ORDER BY column_name;

SELECT
  pg_typeof(status_changed_at)::text AS status_changed_at_rt,
  pg_typeof(paid_at)::text           AS paid_at_rt,
  pg_typeof(subtotal)::text          AS subtotal_rt,
  pg_typeof(total)::text             AS total_rt,
  pg_typeof(line_items)::text        AS line_items_rt
FROM public.invoices
LIMIT 1;

SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('invoices','invoice_shares')
ORDER BY tablename, indexname;
```
