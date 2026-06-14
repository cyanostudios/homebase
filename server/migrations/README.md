# Migrations

## 076–089 – Teams, Requests, Schedule, Matches (jun 2026)

### Teams (076–079, 088)

- **`076-teams.sql`** — tabell `teams` (tenant-DB). Körs via:

```bash
npm run migrate:teams
```

- **`077-grant-teams-plugin-access.sql`** — **`MAIN_DB_ONLY`**. Lägger till `teams` i `tenant_plugin_access` / `user_plugin_access`. Kör på huvuddatabasen (Neon SQL editor eller `DATABASE_URL`/`PROD_MAIN_DATABASE_URL`), eller använd `npm run set:tenant-plugins -- --enable=teams`.
- **`078-teams-team-notes.sql`** — kolumn/JSON för `team_notes`:

```bash
npm run migrate:teams-team-notes
```

- **`079-teams-series-teams.sql`** — `series_teams` JSON:

```bash
npm run migrate:teams-series-teams
```

- **`088-teams-add-external-id.sql`** — `external_team_id` (FOGIS-koppling). Körs tillsammans med 087:

```bash
npm run migrate:matches-team-external
```

### Requests (080–082)

- **`080-requests.sql`**, **`082-requests-add-user-id.sql`** — tabell `requests` + `user_id`:

```bash
npm run migrate:requests
```

- **`081-grant-requests-plugin-access.sql`** — **`MAIN_DB_ONLY`**. Samma mönster som 077; alternativt `set:tenant-plugins --enable=requests`.

### Schedule (083–086)

- **`083-schedule.sql`** — tabell `schedule_events`:

```bash
npm run migrate:schedule
```

- **`084-grant-schedule-plugin-access.sql`** — **`MAIN_DB_ONLY`**. Samma mönster som 077.
- **`085-schedule-add-user-id.sql`**:

```bash
npm run migrate:schedule-user-id
```

- **`086-schedule-event-team-id.sql`** — `team_id` på schedule events:

```bash
npm run migrate:schedule-event-team-id
```

### Matches (087, 089)

- **`087-matches-add-team-external.sql`** — `team_id`, `external_id` på `matches` (körs med 088):

```bash
npm run migrate:matches-team-external
```

- **`089-matches-add-result-status.sql`** — `home_score`, `away_score`, `result`, `competition_name`, `is_canceled`, `is_finished`, `is_postponed`:

```bash
npm run migrate:matches-result
```

**Parity:** kör tenant-scripts mot alla tenants lokalt och på prod (se `docs/LOCAL_PROD_PARITY.md`). `MAIN_DB_ONLY`-filer körs en gång per huvuddatabas.

---

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

## 058–063 – Cups (tenant-DB)

- **`058-cups-v1.sql`** — tabell `cups` (ingår i ordinarie tenant-migrationer vid nya tenants).
- **`050-cups-sanctioned.sql`** — kolumn `sanctioned` (egenskap för sanktionerad cup). **Redan skapade tenants** (one-shot):

```bash
npm run migrate:cups-sanctioned
```

- **`060-cups-upsert-index.sql`** — partiellt unikt index för import-upsert. **Redan skapade tenants** (one-shot):

```bash
npm run migrate:cups-upsert-index
```

- **`061-cups-match-format-team-count.sql`** — kolumner `team_count`, `match_format`. **Redan skapade tenants** (one-shot):

```bash
npm run migrate:cups-team-count
```

- **`062-cups-visible.sql`** — kolumn `visible` (styr om cup visas i publik listning). **Redan skapade tenants** (one-shot):

```bash
npm run migrate:cups-visible
```

- **`063-cups-featured.sql`** — kolumn `featured` (utvald cup i publik toppsektion, default av). **Redan skapade tenants** (one-shot):

```bash
npm run migrate:cups-featured
```

Kräver `DATABASE_URL`; lokalt schema-per-tenant: `TENANT_PROVIDER=local`.

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
