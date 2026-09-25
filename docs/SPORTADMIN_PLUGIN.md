# SportAdmin Connector — operator notes

Plugin id: **`sportadmin`**. Nav label: **SportAdmin** (sidebar category **Beta**). Read-only connector for a club’s **public** SportAdmin site → isolated Homebase cache + admin/Teams UI.

**Working tree / local-first; not a prod release by itself.** QA **Godkänt** 2026-09-24 (incl. S1 host-gate re-review). Security **Godkänt** 2026-09-24 (S1 fixed; residuals **S2/S3/S5** await TPM conscious acceptance — see below).

## Enable (local)

```bash
npm run migrate:sportadmin
npm run set:tenant-plugins -- --email=user@example.com --enable=sportadmin
```

Then **log out and log in** so `/api/auth/me` refreshes `user.plugins`.

Use `--both` / `PROD_MAIN_DATABASE_URL` only on **explicit** release or parity (Release Discipline). Migration **`168`** grants plugin access rows on the main DB when the migrate script runs — do not point that at production without a release decision.

## Surfaces

Settings-style shell (`PluginSettingsPageShell`) at **`/sportadmin`** — not a Contacts-class CRUD list.

| Tab             | Purpose                                                                                                                                                                                                                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Integration** | SportAdmin site URL, connection test, sync status/counts, Sync now, error list — stacked `DETAIL_VIEW` cards                                                                                                                                                                                                    |
| **Teams**       | Read-only list + detail of cached teams (SID pages) — description/info/news/matches/**truppen**/ **kontakt**/source tabs; **no live SportAdmin calls from the browser**; open `source_url` externally. Description + news images use shared **`ImageLightbox`** (header thumbs do not). Bildgalleri not synced. |
| **Pages**       | Read-only club navigation pages — description + news images use **`ImageLightbox`** (identity thumbs do not).                                                                                                                                                                                                   |
| **Debug**       | Discovery tree / snapshot from last sync                                                                                                                                                                                                                                                                        |

No public club website / SEO routes in this MVP.

## Configuration & sync

- Admin saves a **public HTTPS** SportAdmin URL (`POST /api/sportadmin/config`).
- **Host allowlist (server fetch):** SportAdmin platform hosts (`*.web.sportadmin.se`, CDN/portal) **or** the single configured club site host (custom domain such as `www.sorgenfriff.se`). Custom domains are kept only if connection test detects a SportAdmin shell; otherwise save is reverted (`NOT_SPORTADMIN`). Still uses `validatePublicHttpsUrl` (HTTPS, no credentials, no private hosts).
- Non-allowlisted crawl URL (neither platform host nor configured site host) → rejected during sync.
- On successful allowlisted save: connection test; if SportAdmin shell detected, full sync so Teams has data.
- Manual refresh: `POST /api/sportadmin/sync`. Cron: `POST /api/cron/sportadmin/sync` + header `x-cron-secret` (same pattern as Cups). **Opt-in** via Integration toggle (`cron_enabled`, default **off**). When enabled, refresh interval is **1440** minutes (once per day). Manual Sync now always works.
- Cron settings: `POST /api/sportadmin/cron-settings` body `{ cronEnabled: boolean }` (CSRF).
- Failures keep last successful cache; status surfaces `last_error` / stale messaging.

## Data isolation

Writes **only** to tenant tables:

| Table                    | Role                                                                           |
| ------------------------ | ------------------------------------------------------------------------------ |
| `sportadmin_config`      | Site URL, interval, sync timestamps, connection test JSON, discovery snapshot  |
| `sportadmin_resources`   | Cached organization / team / news / match / event / link (`content_hash` skip) |
| `sportadmin_sync_errors` | Structured sync errors (no credentials)                                        |

**Does not** write to operative `teams`, `matches`, or `schedule`.

## API (plugin-owned)

Base: `/api/sportadmin` — `requirePlugin('sportadmin')`; CSRF on `POST`.

| Method | Path             | Notes                                        |
| ------ | ---------------- | -------------------------------------------- |
| GET    | `/`              | Status, counts, sync meta, connection test   |
| POST   | `/config`        | Body `{ siteUrl }` — allowlist gate          |
| POST   | `/cron-settings` | Body `{ cronEnabled }` — opt-in daily cron   |
| POST   | `/sync`          | Manual sync                                  |
| GET    | `/errors`        | Recent sync errors                           |
| GET    | `/discovery`     | Debug tree / snapshot                        |
| GET    | `/organization`  | Cached org                                   |
| GET    | `/teams`         | Cached teams                                 |
| GET    | `/news`          | `?limit=`                                    |
| GET    | `/matches`       | `?limit=` `?upcoming=` `?team=` `?category=` |
| GET    | `/events`        | Cached calendar events                       |
| GET    | `/links`         | Cached public links                          |

Stable resource ids: `sportadmin:{type}:{source_id}`. News list API returns title/excerpt (not raw HTML body). Images stored as external `source_image_url` only (no binary download).

## Migrations

| File                                     | DB                    | Effect                                                                                  |
| ---------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| `167-sportadmin-connector.sql`           | Tenant                | Config + resources + sync errors                                                        |
| `168-grant-sportadmin-plugin-access.sql` | Main (`MAIN_DB_ONLY`) | Idempotent grant of `sportadmin` on `tenant_plugin_access` / owner `user_plugin_access` |
| `169-sportadmin-cron-opt-in.sql`         | Tenant                | `cron_enabled` (default false) + daily `refresh_interval_minutes` default 1440          |

Runner: `npm run migrate:sportadmin` (`scripts/run-sportadmin-migration.js`).

## Security residuals (TPM)

From Security **Godkänt** 2026-09-24 — **not silently accepted**; TPM must consciously accept or reject for beta:

| ID     | Severity | Summary                                                                                                                                                                                               |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S2** | Medium   | Regex HTML allowlist sanitizer; mitigated (news `content` not in Teams UI; Teams `description` is plain text; no `dangerouslySetInnerHTML`). Prefer DOMPurify/`sanitize-html` before any HTML render. |
| **S3** | Low–Med  | External `source_image_url` in authenticated Teams detail `<img>`.                                                                                                                                    |
| **S5** | Info     | Migration `168` broad grant when migrate runs — prod only on explicit release.                                                                                                                        |

**S4** (DNS rebinding / hostname-only SSRF baseline) is platform-level (shared with ingest), not SportAdmin-specific.

**S1** (arbitrary public HTTPS via `siteHost` self-allow) — **fixed** (fixed allowlist + `HOST_NOT_ALLOWED`).

## Limits & non-goals (beta)

- First verified club: Sorgenfri FF (fixtures under `plugins/sportadmin/__fixtures__/`). HTML variance across clubs is expected.
- No SportAdmin login/credentials; no crawl of private endpoints.
- Custom club domains **outside** the allowlist cannot be configured until ADR extends hosts.
- Teams UI: read-only list + detail for cached SID teams (tabs include description/news/matches/roster/contact from team payload). Club-wide news/matches/events also remain on plugin APIs. **Pages** tab: club navigation pages. Bildgalleri not synced.
- No projection into FOGIS/operative calendars.

## Related docs

- ADR: [`docs/ai/adr/SPORTADMIN_CONNECTOR_BETA_MVP.md`](./ai/adr/SPORTADMIN_CONNECTOR_BETA_MVP.md)
- Discovery: [`docs/ai/discovery/SPORTADMIN_SORGENFRI_FF.md`](./ai/discovery/SPORTADMIN_SORGENFRI_FF.md)
- UX: [`docs/ai/design/SPORTADMIN_CONNECTOR_UX.md`](./ai/design/SPORTADMIN_CONNECTOR_UX.md)
- Product changelog: [`docs/CHANGELOG.md`](./CHANGELOG.md) §2026-09-25 Shared ImageLightbox (+ SportAdmin Demo→Teams / team tabs)
- Cron pattern: [`docs/CUPS_AUTO_REFRESH_CRON.md`](./CUPS_AUTO_REFRESH_CRON.md)
