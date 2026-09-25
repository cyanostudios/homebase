# ADR: SportAdmin Connector — beta MVP

**Status:** Accepted (implemented beta MVP; local-first)  
**Date:** 2026-09-24  
**Discovery:** [`../discovery/SPORTADMIN_SORGENFRI_FF.md`](../discovery/SPORTADMIN_SORGENFRI_FF.md)  
**Operator notes:** [`../../SPORTADMIN_PLUGIN.md`](../../SPORTADMIN_PLUGIN.md)  
**Scope source:** TPM Grind 1 — isolated storage; do not write to `teams` / `matches` / `schedule`.  
**Gates:** QA Godkänt 2026-09-24; Security Godkänt 2026-09-24 (S1 fixed; residuals S2/S3/S5 → TPM).

## Context

Homebase needs a **read-only** connector that turns a club’s **public** SportAdmin site into structured, cached Homebase data for an admin status UI and a minimal demo frontend. First verification club: Sorgenfri FF. Configuration is a single **SportAdmin site URL** (no hard-coded club IDs).

Operative plugins already own `/api/teams`, `/api/matches`, and `/api/schedule`. News has no existing plugin. Grind 1 chose **isolated connector storage** and plugin-owned read APIs for beta.

Public SportAdmin (verified) uses ASP HTML with query params `ID`, `SID`, `NID`, `AID`; calendar AJAX returns HTML; embedded webcal may return HTTP 410. Login hosts must never be used.

## Decision

### 1. New plugin `sportadmin`

| Item        | Value                                                                                          |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Plugin name | `sportadmin`                                                                                   |
| `routeBase` | `/api/sportadmin`                                                                              |
| Access      | `requirePlugin('sportadmin')` + CSRF on mutations                                              |
| Tenant data | New tables prefixed `sportadmin_`                                                              |
| Main DB     | Grant migration for `tenant_plugin_access` (local-first; prod enable only on explicit release) |

Register in `pluginRegistry` + `routeMap` as a settings-style plugin (admin + demo), not a full Contacts-class CRUD entity browser. Frontend still follows [`docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](../../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md) for shell/header patterns where applicable; Designer owns layout of status/demo surfaces.

### 2. Thin provider seam (not a platform rewrite)

Inside the plugin only:

```text
ContentProvider (interface)
  └── SportAdminProvider
```

Normalized resource types: `organization`, `team`, `news`, `match`, `event`, `link`.

Public JSON shapes use **source-agnostic field names** (`type`, `name`, `title`, …) plus attribution (`source`, `source_id`, `source_url`, `imported_at`). Stable ids: `sportadmin:{type}:{source_id}`.

**Do not** mount `/api/teams`, `/api/news`, `/api/matches`, or `/api/events` at the app root in this MVP. Those names collide with existing plugins or imply a platform content bus that does not exist yet. Beta contract:

```text
GET /api/sportadmin                    # status + counts + sync metadata
GET /api/sportadmin/organization
GET /api/sportadmin/teams
GET /api/sportadmin/news
GET /api/sportadmin/matches
GET /api/sportadmin/events
GET /api/sportadmin/links
POST /api/sportadmin/config            # save URL + run connection test
POST /api/sportadmin/sync              # manual refresh
GET  /api/sportadmin/errors
GET  /api/sportadmin/discovery         # debug tree (dev/admin)
```

Query filters (against **cached** rows only): `limit`, `upcoming`, `team`, `category` (e.g. flickor/pojkar).

Future platform façade (`GET /api/news` choosing a provider) is an explicit later epic.

### 3. Module layout (plugin-internal)

Suggested layout at Grind 2; **verified implementation** folds cache into `model.js` upsert+hash and scheduler into `services/cronSync.js` + `server/core/routes/cron.js` (allowed refinement):

```text
plugins/sportadmin/
  client/          # HTTP: timeout, redirects, encoding, UA, backoff, concurrency cap + host allowlist
  discovery/       # start from site URL → nav, SID/ID/NID/AID, calendar AJAX URL
  parser/          # Organization, Team, News, Match, Calendar, Link, Image (separate)
  normalizer/
  model.js         # DB access + content_hash skip
  services/        # syncService + cronSync
  providers/       # ContentProvider seam + SportAdminProvider
  controller.js / routes.js / index.js / plugin.config.js
  sanitize/        # HTML/URL allowlists for imported content
  __fixtures__/ / __tests__/
```

Parsers are **tolerant and separate**. No single mega-selector. Selectors and URL patterns come from the discovery report and fixtures — not from guessed structure.

**SSRF (verified):** fetch hosts are a **fixed** SportAdmin-related allowlist (not “whatever host was saved”). `POST /config` returns **400** `HOST_NOT_ALLOWED` for non-allowlisted URLs — no save, no fetch.

### 4. Access strategy (ordered)

1. Public HTML GET on club `*.web.sportadmin.se` (and configured base).
2. Public ASP widgets that return HTML without auth (e.g. `kalender/ajaxKalender.asp?ID=`).
3. iCal/webcal **only if** discovered URL returns success; 410/missing → connection-test **warning**.

Forbidden: identity/portal/entry login, credentials, cookies from admin sessions, probing private endpoints, aggressive parallel crawl.

**SSRF:** Reuse `validatePublicHttpsUrl` / ingest SSRF patterns. **Additionally** restrict fetch to a **fixed** SportAdmin-related host allowlist (club `*.web.sportadmin.se` + known CDN/portal hosts — see [`SPORTADMIN_PLUGIN.md`](../../SPORTADMIN_PLUGIN.md)). Do not trust “configured site host == fetch host” as an allow rule. Reject private IPs and non-HTTPS. Do not download image binaries.

### 5. Tenant schema (isolated)

Suggested tables (Backend may refine names/columns within this shape):

- `sportadmin_config` — one row per tenant: `site_url`, `cron_enabled` (default **false**), `refresh_interval_minutes` (default **1440** / daily when cron on), sync timestamps, `last_error`, connection-test JSON.
- `sportadmin_resources` — polymorphic or typed tables for organization/team/news/match/event/link with: `id`, `source`, `source_id`, `type`, payload JSON or columns, `source_url`, `source_image_url`, `content_hash`, `imported_at`, `updated_at`.
- `sportadmin_sync_errors` — structured errors without PII (`resource`, `status`, `message`). (ADR draft name `sportadmin_sync_runs` was refined to this error log table.)

Incremental sync: skip write when `content_hash` unchanged.

### 6. Scheduler

- Scheduled sync is **opt-in** (`cron_enabled`; Integration toggle). Default **off** for beta. When on, interval is **once per day** (1440 minutes).
- Automatic sync via existing cron pattern: `POST /api/cron/sportadmin/sync` + `x-cron-secret` (mirror cups) — skips tenants with cron off. Manual `POST /api/sportadmin/sync` for admins always available.
- On SportAdmin failure: keep serving last successful resources; surface `last_successful_sync` + error on status.

### 7. Rate limiting

Queue discovered URLs; low concurrency (e.g. 1–2); timeout; exponential backoff; dedupe URLs per run. First crawl must not fan out hundreds of parallel requests.

### 8. Sanitization (design requirement; Security owns approval)

Imported HTML (news body) passes an allowlist sanitizer before store and before any render. Sanitize URLs (`http`/`https` only). Never store credentials. Never render raw imported HTML in admin/demo without sanitization.

### 9. Connection test + discovery debug

On save URL (allowlisted host only): reachable → SportAdmin shell detected → organization / teams / news / matches / calendar each ✓ or ⚠. Non-allowlisted URL is rejected before save (`HOST_NOT_ALLOWED`). Partial discovery does not block save if the URL host is allowlisted and the site is SportAdmin-like and reachable.

Debug endpoint/UI shows tree: start → discovered links → parser used → counts → errors (Designer shapes UI).

### 10. Frontend surfaces (contracts only)

- **Admin (Integration):** URL, status, last/next sync, counts, Sync now, errors, discovery/debug.
- **Teams:** read-only list + detail over `sportadmin_` cache (SID-derived teams); fields include name, category, age_group, description, source_url, source_image_url, import timestamps. Embedded mail-layout list|detail inside the settings shell Teams category — no Form/CRUD, no Contacts-class registry View.
- **Debug:** discovery tree / snapshot from last sync.

No public club website, no SEO routes in this MVP. Persist `source_url` for future canonical/source.

### 11. Testing

Jest unit tests with **fixtures** under `plugins/sportadmin/__fixtures__/` (HTML from discovery URLs). Online SportAdmin is not a test dependency. Cover parsers, normalize, hash skip, cache failure path, sanitization.

## Alternatives considered

| Option                                      | Why rejected for beta                                                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Merge into `teams` / `matches` / `schedule` | Grind 1 decision; collides with FOGIS and operational calendars                                                        |
| App-root `/api/news` etc. as provider bus   | No existing bus; premature platform abstraction                                                                        |
| Depend on webcal as primary calendar        | Live feed returned 410; HTML AJAX is real                                                                              |
| Extend `ingest` only                        | Ingest is generic fetch without SportAdmin parsers/admin/demo; keep sportadmin as owning plugin, reuse SSRF/HTTP ideas |

## Ansvarsfördelning

### Backend

- Plugin scaffold, migrations (tenant + local grant), models, HTTP client, discovery, parsers, normalizer, cache/hash, sync job, cron hook, API routes, sanitization pipeline, structured logging, fixtures + unit tests.

### Frontend

- Admin status/config/sync/errors/debug and read-only Teams list|detail consuming `/api/sportadmin/*` only.
- Follow plugin integration checklist + view guide for shell / embedded list|detail; implement Designer’s flows.
- No live SportAdmin calls from the browser.

### UI/UX Designer (before FE implementation)

- Wireframes/flows for connection test results (✓/⚠), stale-cache messaging, Sync now, error list, discovery tree, Teams list|detail.

### Security Expert (gate)

- SSRF allowlist, XSS sanitizer choice, public-only crawl policy, no credential storage.

### Documentation Specialist (gate)

- Plugin behaviour doc after verified implementation.

## Återanvändningsbedömning

| Candidate                                      | Verdict                                          |
| ---------------------------------------------- | ------------------------------------------------ |
| `validatePublicHttpsUrl` / ingest SSRF helpers | **Reuse** (shared core utils)                    |
| Ingest run history UX                          | **Pattern only** — sportadmin owns sync runs     |
| Cups cron (`/api/cron/…` + secret)             | **Reuse pattern** for scheduled sync             |
| Matches FOGIS settings page shell              | **UI pattern** for settings/status               |
| Plugin backend/frontend templates              | **Reuse** for scaffold                           |
| `teams` / `matches` / `schedule` tables        | **Do not write**                                 |
| Downloading images to files plugin             | **Out of scope** — store `source_image_url` only |

## Risker och beroenden

| ID  | Risk                              | Severity | Acceptable for beta?                                                  |
| --- | --------------------------------- | -------- | --------------------------------------------------------------------- |
| R1  | HTML structure differs per club   | Medium   | Yes — modular parsers + discovery debug; fixtures from one club first |
| R2  | Admin-configured URL SSRF         | High     | Mitigate with HTTPS + host allowlist; Security gate                   |
| R3  | XSS via news HTML                 | High     | Allowlist sanitizer; Security gate                                    |
| R4  | Encoding (`iso-8859-1`) mojibake  | Medium   | Client must respect charset                                           |
| R5  | Calendar webcal unavailable       | Low      | Warning path; HTML calendar primary                                   |
| R6  | Live site drift vs fixtures       | Medium   | Fixtures pin parser behaviour; re-capture when needed                 |
| R7  | Rate limits / SportAdmin blocking | Medium   | Queue + low concurrency + cache                                       |

## Avvägningar

- **Simplicity over platform bus:** plugin-scoped APIs now; provider interface local for future extraction.
- **HTML calendar over broken iCal:** resilience > perfect Priority-3 purity.
- **Isolated storage over merging ops data:** avoids corrupting FOGIS/manual schedules.
- **External image URLs over binary cache:** less storage and legal surface for MVP.

## Affärskonsekvenser

- Demo proves connector value without building a public website epic.
- Sorgenfri FF–specific IDs stay in fixtures; onboarding another club is URL + discovery, not code fork.
- Projection into operative `teams`/`matches` remains a later product decision.

## ADR applicability

This ADR **is** the architecture decision record for the beta connector (new plugin + isolated API surface).

## Implementation order (for developers)

1. Scaffold plugin + config table + status API.
2. HTTP client + SSRF/host guards.
3. Discovery from start URL (nav + `lagmeny` SIDs).
4. Parsers per type using fixtures from discovery report.
5. Cache + hash skip + manual sync.
6. Cron interval sync.
7. Connection test + discovery debug API.
8. Admin + demo UI per Designer.
9. Tests green offline.

## References

- Operator notes: [`SPORTADMIN_PLUGIN.md`](../../SPORTADMIN_PLUGIN.md)
- Discovery: [`SPORTADMIN_SORGENFRI_FF.md`](../discovery/SPORTADMIN_SORGENFRI_FF.md)
- Checklist: [`../../NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](../../NEW_PLUGIN_INTEGRATION_CHECKLIST.md)
- View guide: [`../../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](../../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md)
- Cron pattern: [`../../CUPS_AUTO_REFRESH_CRON.md`](../../CUPS_AUTO_REFRESH_CRON.md)
