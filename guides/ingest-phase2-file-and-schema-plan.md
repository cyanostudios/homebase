# Ingest plugin – Phase 2: files & schema plan

Output of **Phase 2** from `ingest-plugin-implementation-guide.md`. No application code yet—only what to create/modify and DB shape.

---

## Assumptions (Homebase tenant DB)

- New tables live in **tenant databases** (same as `notes`, `contacts`, `pulse_*`).
- Migrations run via existing tenant migration flow (`server/migrations/*.sql`).
- **`user_id`** is required on tenant tables: `PostgreSQLAdapter` / `db.insert()` expects it (see `001-initial-schema.sql`, `notes` model). Models use `Database.get(req)` and do not pass `user_id` manually on insert—**columns must exist** in schema.
- Queries use tenant-scoped adapter behavior like notes (`SELECT * FROM …` without explicit `user_id` in WHERE where adapter injects scope)—**verify** against current adapter for `ingest_*` table names on first implementation; if raw `query()` does not scope, add explicit `user_id` filter using `Context.getTenantUserId(req)` (pulses pattern).

---

## 1. Files to **create**

### Database

| Path                                                | Purpose                                                |
| --------------------------------------------------- | ------------------------------------------------------ |
| `server/migrations/054-ingest-sources-and-runs.sql` | Create `ingest_sources` + `ingest_runs` + indexes + FK |

### Backend (`plugins/ingest/`)

| Path                                       | Purpose                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `plugins/ingest/plugin.config.js`          | `name: 'ingest'`, `routeBase: '/api/ingest'`, `requiredRole: 'user'`                                          |
| `plugins/ingest/index.js`                  | `initializeIngestPlugin(context)` → `{ config, router, model, controller }` (notes-style single arg)          |
| `plugins/ingest/routes.js`                 | `createIngestRoutes(controller, context)` — gate, CSRF, validators                                            |
| `plugins/ingest/controller.js`             | Thin handlers: sources CRUD, `runImport`, `getRunsForSource`                                                  |
| `plugins/ingest/model.js`                  | Persistence only: sources + runs + `markSourceFetchResult`                                                    |
| `plugins/ingest/services/fetchSource.js`   | HTTP fetch, capped excerpt, normalized result object                                                          |
| `plugins/ingest/services/runIngest.js`     | Orchestrate: load source → create run → fetch → update run + source                                           |
| `plugins/ingest/services/ingestService.js` | **Reusable** API: e.g. `runSourceById(req, sourceId)`, `fetchSourceFromRecord(req, record)` for other plugins |

### Frontend (`client/src/plugins/ingest/`)

| Path                              | Purpose                                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `types/ingest.ts`                 | `IngestSource`, `IngestSourcePayload`, `IngestRun`, `PanelMode`, `ValidationError` |
| `api/ingestApi.ts`                | Wrap `/api/ingest` (sources + `/:id/runs`, `POST :id/run`)                         |
| `context/IngestContext.tsx`       | Panel state, list, runs cache, CRUD + `runIngestSource` / `loadIngestRuns`         |
| `hooks/useIngest.ts`              | `useIngestContext()` wrapper                                                       |
| `components/IngestSourceList.tsx` | Main list + toolbar                                                                |
| `components/IngestSourceForm.tsx` | Create/edit fields (inline Save/Cancel per project standards)                      |
| `components/IngestSourceView.tsx` | Detail: metadata, last run, excerpt, run button, recent runs                       |

**Not in v1 (per guide):** `IngestSettingsForm.tsx` (skip unless real settings exist), `IngestDashboardWidget`, separate run list page.

---

## 2. Files to **modify**

| Path                                   | Change                                                                                                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `client/src/core/pluginRegistry.ts`    | Register `ingest`: Provider, hook, `panelKey`, `List` / `Form` / `View`, `navigation` (e.g. **Tools**), optional `displayPrefix`, optional `dashboardWidget` later |
| `client/src/core/routing/routeMap.ts`  | Add `ingest: '/ingest'` to `navPageToPath`                                                                                                                         |
| `client/src/core/ui/Sidebar.tsx`       | Add `'ingest'` to `NavPage` union                                                                                                                                  |
| `client/src/core/ui/DetailSection.tsx` | Add `'ingest'` to `DetailSectionIconPlugin`                                                                                                                        |
| `client/src/index.css`                 | Add `--plugin-ingest` (light/dark) + `.plugin-ingest { --plugin-color: … }`                                                                                        |
| `client/src/i18n/locales/en.json`      | `nav.ingest` + `ingest.*` keys (list, form, view, validation, activity if used)                                                                                    |
| `client/src/i18n/locales/sv.json`      | Same                                                                                                                                                               |
| `server/migrations/README.md`          | Short bullet for `054-ingest-*.sql` (optional, when migration lands)                                                                                               |
| `docs/CHANGELOG.md`                    | Entry when feature ships (optional at phase 2; do in final PR)                                                                                                     |

**Explicitly not required for v1:** `App.tsx`, `AppContext.tsx`, `plugin-loader.js`, `server/core/*` (unless a bug appears).

**Optional later:** `client/src/types/global.d.ts` only if a settings form uses window bridge.

---

## 3. Proposed SQL schema (`054-ingest-sources-and-runs.sql`)

### `ingest_sources`

| Column              | Type                                   | Notes                                              |
| ------------------- | -------------------------------------- | -------------------------------------------------- |
| `id`                | SERIAL PK                              |                                                    |
| `user_id`           | INT NOT NULL                           | Tenant row ownership (required by adapter pattern) |
| `name`              | VARCHAR(255) NOT NULL                  |                                                    |
| `source_url`        | VARCHAR(2000) NOT NULL                 |                                                    |
| `source_type`       | VARCHAR(20) NOT NULL                   | `html`, `pdf`, `json`, `xml`, `other`              |
| `fetch_method`      | VARCHAR(50) NOT NULL                   | `generic_http` (default) or `browser_fetch`        |
| `is_active`         | BOOLEAN NOT NULL DEFAULT true          |                                                    |
| `notes`             | TEXT                                   | nullable                                           |
| `last_fetched_at`   | TIMESTAMP                              | nullable                                           |
| `last_fetch_status` | VARCHAR(20) NOT NULL DEFAULT `'never'` | `success` \| `failed` \| `never`                   |
| `last_fetch_error`  | TEXT                                   | nullable                                           |
| `created_at`        | TIMESTAMP NOT NULL DEFAULT NOW()       |                                                    |
| `updated_at`        | TIMESTAMP NOT NULL DEFAULT NOW()       |                                                    |

Indexes: `(user_id)`, optional `(user_id, updated_at DESC)`.

### `ingest_runs`

| Column           | Type                                                         | Notes                                                            |
| ---------------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| `id`             | SERIAL PK                                                    |                                                                  |
| `user_id`        | INT NOT NULL                                                 | Same as sources                                                  |
| `source_id`      | INT NOT NULL REFERENCES ingest_sources(id) ON DELETE CASCADE |                                                                  |
| `status`         | VARCHAR(20) NOT NULL                                         | `success` \| `failed`                                            |
| `started_at`     | TIMESTAMP NOT NULL DEFAULT NOW()                             |                                                                  |
| `completed_at`   | TIMESTAMP                                                    | nullable until finished                                          |
| `http_status`    | INT                                                          | nullable                                                         |
| `content_type`   | VARCHAR(255)                                                 | nullable                                                         |
| `content_length` | INT                                                          | nullable                                                         |
| `raw_excerpt`    | TEXT                                                         | **capped in app** (e.g. 8–32 KiB chars)—do not store full bodies |
| `error_message`  | TEXT                                                         | nullable                                                         |
| `created_at`     | TIMESTAMP NOT NULL DEFAULT NOW()                             |                                                                  |
| `fetch_method`   | VARCHAR(50)                                                  | nullable on legacy rows; set per run (`057` migration)           |
| `updated_at`     | TIMESTAMP                                                    | added in `056` for ORM updates                                   |

Indexes: `(source_id)`, `(source_id, started_at DESC)` for history.

### Idempotency

Use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` to match other migrations.

---

## 4. API routes (implementation checklist)

Aligned with guide §9:

| Method | Path                   | Purpose                                |
| ------ | ---------------------- | -------------------------------------- |
| GET    | `/api/ingest`          | List sources                           |
| GET    | `/api/ingest/:id`      | One source                             |
| POST   | `/api/ingest`          | Create source                          |
| PUT    | `/api/ingest/:id`      | Update source                          |
| DELETE | `/api/ingest/:id`      | Delete source                          |
| GET    | `/api/ingest/:id/runs` | Runs for source (paginate optional v1) |
| POST   | `/api/ingest/:id/run`  | Trigger import (CSRF + validation)     |

---

## 5. Blockers

**None identified.** Schema does not depend on unknown infrastructure beyond existing tenant migration + `Database.get(req)` pattern.

**Open point for Phase 3:** Confirm whether raw `db.query('SELECT * FROM ingest_sources')` is tenant-filtered the same as `notes`; if not, add explicit `user_id` from `Context.getTenantUserId(req)` in model queries.

---

## 6. Next step

**Phase 3:** Create backend skeleton (`plugin.config.js`, `index.js`, `routes.js`, `controller.js`, `model.js`) **without** fetch logic—wire routes to stub responses or minimal DB reads after migration exists.
