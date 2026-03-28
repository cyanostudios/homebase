# Migrations

## 054 / 055 / 056 – Ingest-plugin

- **`054-ingest-sources-and-runs.sql`** — tabeller `ingest_sources` och `ingest_runs` på **tenant-/data-databaser**. Körs som vanliga tenant-migrationer.
- **`055-grant-ingest-plugin-access.sql`** — markerad **`MAIN_DB_ONLY`**; körs **inte** i per-tenant-schema. Lägger till `plugin_name = 'ingest'` i `tenant_plugin_access` (alla tenants) och i `user_plugin_access` för varje tenantägare (`COALESCE(owner_user_id, user_id)`). Idempotent (`ON CONFLICT DO NOTHING`).
- **`056-ingest-runs-updated-at-and-rss-cleanup.sql`** — tenant-DB: kolumn `updated_at` på `ingest_runs` (krävs för `db.update()` vid körningsuppdateringar); `source_type = 'rss'` mappas till `'other'`.

**Huvuddatabasen (plugin-access för ingest):**

```bash
npm run migrate:ingest-plugin-access
```

Sätt `DATABASE_URL` till huvudapplikationens databas (samma som för `migrate:remove-cups-plugin-access`).

---

## 052 / 053 – Borttagning av cups-plugin (teardown)

- **`052-drop-cups-tables.sql`** — `DROP TABLE` för `cups` och `cup_sources` på **tenant-/data-databaser** där cups-tabellerna fanns. Körs som övriga tenant-migrationer (lokalt schema-per-tenant: filtreras som vanligt; se `LocalTenantProvider`).
- **`053-remove-cups-plugin-access.sql`** — markerad **`MAIN_DB_ONLY`**; körs **inte** i per-tenant-schema-migrationer. Tar bort rader med `plugin_name = 'cups'` från `user_plugin_access` och `tenant_plugin_access` när tabellerna finns (säker `DO $$ ... IF EXISTS`-block).

**Huvuddatabasen (plugin-access):**

```bash
npm run migrate:remove-cups-plugin-access
```

Sätt `DATABASE_URL` till huvudapplikationens databas. Historiska filer `045`–`051` lämnas i repot för redan körda miljöer; `052`/`053` är framåtriktad städning.

---

## 033-pulses-plugin.sql

Skapar tabellerna `pulse_settings` och `pulse_log` för Pulse (SMS)-pluginet.

**Kör på alla tenants:**

```bash
npm run migrate:pulses
```

Kräver `DATABASE_URL`. Vid lokalt schema-per-tenant: `TENANT_PROVIDER=local`. Idempotent (`CREATE TABLE IF NOT EXISTS`).

---

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
