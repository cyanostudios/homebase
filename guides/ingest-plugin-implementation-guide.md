# Ingest Plugin Implementation Guide for Cursor

Use this document as the **single source of truth** when building the new Homebase plugin named **`ingest`**.

This plugin is **not** a domain plugin.  
It is a **shared capability plugin** that other plugins can use later.

Its purpose is to:

- register external sources
- fetch source content from URLs
- store source metadata and import history
- expose reusable backend services for other plugins
- provide a simple admin UI for managing sources and running imports

It must be built in a way that matches Homebase architecture and avoids guessing.

---

## 1. Non-negotiable rules

1. **Do not guess file contents**
   - Read files before modifying them.
   - If a referenced file does not exist or differs from expectation, stop and report it.

2. **Do not modify core files unless absolutely required**
   Protected files include:
   - `App.tsx`
   - `AppContext.tsx`
   - `pluginRegistry.ts`
   - `server/plugin-loader.js`
   - `server/core/*`
   - any `core/` file

   If a core file must be changed:
   - show current contents first
   - explain why change is required
   - keep change minimal

3. **Use the templates as the base**
   - Backend must start from `templates/plugin-backend-template`
   - Frontend must start from `templates/plugin-frontend-template`
   - Do not invent a new structure

4. **Do not build a domain parser yet**
   - This plugin builds the foundation only
   - No domain-specific normalization for cups, recipes, events, etc.
   - No special per-site parsing in v1

5. **Do not build public pages**
   - This is internal/admin capability only

6. **Keep controllers thin**
   - Heavy logic belongs in services
   - Reusable logic belongs in shared plugin service files

7. **Use existing Homebase patterns**
   - plugin config
   - routes
   - controller
   - model
   - service layer
   - frontend context/hook/api/components
   - plugin registry

8. **Stop after each implementation phase**
   After each phase, report:
   - files read
   - files created
   - files modified
   - what remains

---

## 2. What this plugin is

The `ingest` plugin is a **shared import/source management capability**.

It should work similarly to the existing mail plugin in one important way:

- the plugin has its own UI and storage
- the plugin also exposes reusable backend functionality for other plugins

This means `ingest` is not just CRUD.
It is a **capability plugin**.

---

## 3. What this plugin is not

The plugin must **not**:

- scrape live content directly from React components
- render raw HTML from source pages in the UI
- try to solve all future ingest cases now
- contain domain-specific models like `cups`, `recipes`, etc.
- become a universal AI parser in v1

---

## 4. Plugin goal for v1

Build a working `ingest` plugin where an authenticated user can:

- create a source
- edit a source
- delete a source
- list all sources
- view one source
- run an import for a source manually
- see result status for the latest import
- store raw fetched content or a controlled excerpt
- view import history

Other plugins must later be able to call shared backend service functions from this plugin.

---

## 5. Naming

Plugin name: `ingest`

Use these names consistently.

### Backend folder

- `plugins/ingest/`

### Frontend folder

- `client/src/plugins/ingest/`

### Route base

- `/api/ingest`

### Frontend naming

Use plural/singular patterns consistently:

- `isIngestPanelOpen`
- `currentIngestSource`
- `panelMode`
- `validationErrors`
- `ingestSources`
- `openIngestSourceForView`
- `openIngestSourceForEdit`
- `closeIngestPanel`
- `saveIngestSource`
- `deleteIngestSource`

If a separate import history model is used in frontend state, name it explicitly:

- `ingestRuns`

---

## 6. Read these files before coding

Before making any changes, read and summarize:

### Existing templates

- `templates/plugin-backend-template/plugin.config.js`
- `templates/plugin-backend-template/model.js`
- `templates/plugin-backend-template/controller.js`
- `templates/plugin-backend-template/routes.js`
- `templates/plugin-backend-template/index.js`

- `templates/plugin-frontend-template/context/TemplateContext.tsx`
- `templates/plugin-frontend-template/hooks/useYourItems.ts`
- `templates/plugin-frontend-template/api/templateApi.ts`
- `templates/plugin-frontend-template/components/YourItemList.tsx`
- `templates/plugin-frontend-template/components/YourItemForm.tsx`
- `templates/plugin-frontend-template/components/YourItemView.tsx`
- `templates/plugin-frontend-template/components/YourItemSettingsForm.tsx`
- `templates/plugin-frontend-template/types/your-items.ts`

### Existing reusable capability plugin reference

Read the existing mail plugin implementation and use it only as a **reference for capability layering**, not as a copy target.

Read:

- mail plugin frontend files
- mail plugin backend files
- especially any service file used by other plugins

### Registry file

Read:

- `client/src/core/pluginRegistry.ts`

Do not modify anything yet.

---

## 7. Required architecture

Use this structure.

### Backend

`plugins/ingest/`

- `plugin.config.js`
- `index.js`
- `routes.js`
- `controller.js`
- `model.js`
- `services/fetchSource.js`
- `services/runIngest.js`
- `services/ingestService.js`

Optional if needed later:

- `services/normalizeContent.js`
- `services/sourceUtils.js`

### Frontend

`client/src/plugins/ingest/`

- `types/ingest.ts`
- `api/ingestApi.ts`
- `context/IngestContext.tsx`
- `hooks/useIngest.ts`
- `components/IngestSourceList.tsx`
- `components/IngestSourceForm.tsx`
- `components/IngestSourceView.tsx`
- `components/IngestSettingsForm.tsx`

Optional later:

- `components/IngestRunList.tsx`
- `components/IngestRunView.tsx`
- `components/IngestDashboardWidget.tsx`

---

## 8. Data model for v1

Do not invent extra tables without need.

### Table 1: `ingest_sources`

Purpose: stores each configured external source.

Recommended fields:

- `id`
- `name`
- `source_url`
- `source_type`
- `fetch_method`
- `is_active`
- `notes`
- `last_fetched_at`
- `last_fetch_status`
- `last_fetch_error`
- `created_at`
- `updated_at`

Definitions:

- `name`: human-readable name
- `source_url`: full URL
- `source_type`: enum-like string, example:
  - `html`
  - `pdf`
  - `json`
  - `xml`
  - `other`
- `fetch_method`: allowed values (stored per source):
  - `generic_http` — direct HTTP (axios), default
  - `browser_fetch` — headless Chromium via Puppeteer; requires `INGEST_BROWSER_FETCH=1`, and a one-time `npm run puppeteer:install-chrome` (Chromium is stored under `.cache/puppeteer`; the API sets `PUPPETEER_CACHE_DIR` to match). With `INGEST_BROWSER_FETCH=1`, the server prints `[ingest:browser_fetch]` startup diagnostics (env, Chrome path/access, memory, HTTPS probe).
- `is_active`: boolean
- `notes`: optional internal notes
- `last_fetched_at`: timestamp of last import attempt
- `last_fetch_status`: example values:
  - `success`
  - `failed`
  - `never`
- `last_fetch_error`: last error text if failed

### Table 2: `ingest_runs`

Purpose: stores import attempts.

Recommended fields:

- `id`
- `source_id`
- `status`
- `started_at`
- `completed_at`
- `http_status`
- `content_type`
- `content_length`
- `raw_excerpt`
- `error_message`
- `created_at`
- `fetch_method` (per-run strategy; nullable on legacy DBs until migration `057-ingest-runs-fetch-method.sql`)

Definitions:

- `source_id`: FK to `ingest_sources`
- `fetch_method`: which strategy ran for this attempt (`generic_http` or `browser_fetch`), independent of the source’s current setting
- `status`: `success` or `failed`
- `started_at`: when fetch started
- `completed_at`: when finished
- `http_status`: returned HTTP status if available
- `content_type`: response content type if available
- `content_length`: response length if available
- `raw_excerpt`: controlled excerpt of raw content, not full unbounded body
- `error_message`: last failure summary

### Important rule for raw content

Do **not** store unlimited full source bodies in v1 unless the existing codebase already has a safe pattern for this.

For v1:

- store a controlled excerpt
- cap the size
- keep the database safe

---

## 9. Backend responsibilities

### `plugin.config.js`

Define:

- `name: 'ingest'`
- `routeBase: '/api/ingest'`
- `requiredRole: 'user'`
- description for source/import capability

### `index.js`

Initialize plugin using the existing template style.

Keep it simple.

### `model.js`

Responsible for persistence only.

Must include methods for:

- `getAllSources(req)`
- `getSourceById(req, id)`
- `createSource(req, data)`
- `updateSource(req, id, data)`
- `deleteSource(req, id)`

- `createRun(req, data)`
- `updateRun(req, id, data)`
- `getRunsForSource(req, sourceId)`
- `getLatestRunForSource(req, sourceId)`

- `markSourceFetchResult(req, sourceId, result)`

Model responsibilities:

- database access
- SQL / insert / update / delete
- row transformation

Model must **not**:

- fetch external URLs
- parse response content
- contain request/controller validation logic

### `controller.js`

Keep thin.

Controller methods:

- `getAllSources`
- `getSource`
- `createSource`
- `updateSource`
- `deleteSource`
- `runImport`
- `getRunsForSource`
- optional `getSettings` and `saveSettings` only if needed

Controller responsibilities:

- call model/service methods
- return JSON
- map errors cleanly

Controller must **not**:

- contain fetching logic
- contain heavy transformation logic

### `routes.js`

Must include:

- auth/enablement gate
- CSRF on state-changing routes
- express-validator input validation
- validateRequest

Minimum routes:

#### Sources

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

#### Runs

- `GET /:id/runs`
- `POST /:id/run`

Do not invent extra routes unless needed.

### `services/fetchSource.js`

This file is critical.

Responsibility:

- dispatch by `fetchMethod` to the correct strategy
- return a normalized fetch result object (same shape for all strategies)

Strategies:

- **`generic_http`** — implemented in this file (axios). Behavior and limits unchanged; not shared with browser fetch.
- **`browser_fetch`** — implemented in `services/fetchSourceBrowserFetch.js` (Puppeteer). Separate code path; no domain parsing.

Input:

- `{ sourceUrl, sourceType, fetchMethod }`

Output example:

```js
{
  ok: true,
  status: 200,
  contentType: 'text/html',
  contentLength: 12345,
  bodyText: '...', // full fetched body for downstream parsing
  excerpt: '...', // diagnostic preview only (capped)
  finalUrl: '...',
}
```

On failure:

```js
{
  ok: false,
  status: null,
  contentType: null,
  contentLength: null,
  bodyText: null,
  excerpt: null,
  finalUrl: null,
  errorMessage: '...'
}
```

Rules:

- do not over-engineer
- keep `generic_http` logic isolated from `browser_fetch`
- cap excerpt length (diagnostic preview only)
- for HTML in `browser_fetch`, keep full fetched HTML in `bodyText`; do not parse from `excerpt`
- for HTML preview quality, prefer content from `<main>`/`<body>` over `<head>` metadata when building `excerpt`
- sanitize obvious null/empty cases
- do not implement site-specific parsing

Browser-fetch diagnostics (observability only):

- capture final effective URL after wait (`finalUrl`)
- capture final document title (embedded in diagnostic comment in `excerpt`)
- classify outcome to distinguish:
  - initial/plain HTTP 403
  - challenge/interstitial still active after wait
  - browser/runtime failure

### `services/runIngest.js`

This service orchestrates a run.

Responsibilities:

1. load source by id
2. create run record as started
3. call `fetchSource` (pass resolved `fetchMethod`; persist same value on the run row)
4. update run record with success/failure
5. update source last fetch fields
6. return run result

### `services/ingestService.js`

This is the shared reusable service for other plugins.

This is the equivalent of mail’s reusable service layer.

Expose functions such as:

- `runSourceById(req, sourceId)`
- `fetchSourceFromRecord(req, sourceRecord)` -> returns normalized fetch result including full `bodyText`
- `fetchSource({ sourceUrl, sourceType, fetchMethod })` -> direct reusable fetch entrypoint with same normalized result
- maybe later: `getLatestSourceContent(req, sourceId)`

This file must be designed for reuse by other plugins later.

---

## 10. Frontend responsibilities

Use the frontend template as the base.

### `types/ingest.ts`

Define:

- `PanelMode`
- `ValidationError`
- `IngestSource`
- `IngestSourcePayload`
- `IngestRun`

Example shape:

- `IngestSource`
  - `id`
  - `name`
  - `sourceUrl`
  - `sourceType`
  - `fetchMethod`
  - `isActive`
  - `notes`
  - `lastFetchedAt`
  - `lastFetchStatus`
  - `lastFetchError`
  - `createdAt`
  - `updatedAt`

- `IngestRun`
  - `id`
  - `sourceId`
  - `status`
  - `startedAt`
  - `completedAt`
  - `httpStatus`
  - `contentType`
  - `contentLength`
  - `rawExcerpt`
  - `errorMessage`
  - `createdAt`

### `api/ingestApi.ts`

Must wrap `/api/ingest`

Methods:

- `getSources()`
- `getSource(id)`
- `createSource(payload)`
- `updateSource(id, payload)`
- `deleteSource(id)`
- `runSource(id)`
- `getRuns(id)`

Keep the same API style as other plugins.

### `context/IngestContext.tsx`

Base it on template context structure.

State should include:

- panel open state
- current source
- panel mode
- validation errors
- ingest sources
- selected source runs
- saving/loading state

Actions should include:

- `openIngestPanel`
- `openIngestSourceForEdit`
- `openIngestSourceForView`
- `closeIngestPanel`
- `saveIngestSource`
- `deleteIngestSource`
- `runIngestSource`
- `loadIngestRuns`

Do not overload this context with advanced state unless needed.

### `hooks/useIngest.ts`

Simple wrapper around context.

### `components/IngestSourceList.tsx`

This is the main list page.

It should show:

- name
- source type
- status
- last fetched
- URL maybe truncated

Toolbar actions:

- search
- add source
- maybe settings later

From this list, user must be able to:

- open detail view
- create new source

### `components/IngestSourceForm.tsx`

Fields for v1:

- name
- source URL
- source type
- fetch method
- active toggle
- notes

Rules:

- follow template form structure
- use unsaved changes handling if template already does
- use window submit/cancel pattern only if consistent with existing templates

### `components/IngestSourceView.tsx`

This detail view should show:

- source metadata
- last status
- last fetch error if any
- last fetched timestamp
- raw excerpt from latest run if available
- button to run import now
- button to edit
- button to delete

Also show a simple list of recent runs if easy.

### `components/IngestSettingsForm.tsx`

Only create if there is a real setting to store.
If there are no meaningful settings in v1, do **not** invent this form.

---

## 11. Validation rules

### Source form validation

Require:

- `name` non-empty
- `sourceUrl` non-empty
- `sourceUrl` valid URL
- `sourceType` one of allowed values
- `fetchMethod` one of allowed values

Allowed source types in v1:

- `html`
- `pdf`
- `json`
- `xml`
- `other`

Allowed fetch methods in v1:

- `generic_http`
- `browser_fetch` (optional; server must enable via `INGEST_BROWSER_FETCH=1`)

Do not add special parser keys yet.

---

## 12. Security and request handling

Match the existing plugin/backend style.

Requirements:

- use plugin gate middleware
- use CSRF on state-changing endpoints
- validate route params and request bodies
- never trust user input
- trim string fields
- cap stored excerpt length
- do not allow arbitrary filesystem access
- do not execute remote content
- do not evaluate scripts

---

## 13. Reuse strategy for future plugins

The shared part of `ingest` is backend capability, not frontend UI.

Other plugins should later be able to do something like:

- look up a source
- run fetch for a source
- read latest run data
- use raw fetched content as input to domain-specific normalization

That means:

- `ingest` owns source registration and fetch history
- future domain plugins own interpretation and mapping

Do not design cross-plugin domain coupling in v1.

---

## 14. What to copy from templates vs what to borrow from mail

### Copy from templates

Use the templates as the base for:

- folder structure
- file naming patterns
- context + hook relationship
- list/form/view structure
- standard CRUD flow
- registry registration pattern

### Borrow from mail

Borrow ideas from mail for:

- capability plugin thinking
- shared backend service file for other plugins
- keeping UI + reusable backend in same plugin
- clean separation between controller and reusable service entrypoints

### Do not copy from mail

Do not blindly copy:

- mail-specific settings patterns
- mail-specific eventing
- provider-specific complexity
- oversized context behavior

---

## 15. Order of implementation

Build in this exact order.

### Phase 1: Read and inventory

Read all required template and reference files.
Produce a short summary of:

- backend template structure
- frontend template structure
- mail capability pattern
- current registry expectations

No code changes.

### Phase 2: Define files and schema

Before coding, produce:

- exact file list to create
- exact file list to modify
- proposed DB tables and fields
- any migration/schema assumptions

Stop and wait if schema creation depends on unknown infrastructure.

### Phase 3: Create backend plugin skeleton

Create:

- `plugins/ingest/plugin.config.js`
- `plugins/ingest/index.js`
- `plugins/ingest/routes.js`
- `plugins/ingest/controller.js`
- `plugins/ingest/model.js`

No fetch logic yet.
Just structure.

### Phase 4: Add backend services

Create:

- `services/fetchSource.js`
- `services/runIngest.js`
- `services/ingestService.js`

Implement one simple generic fetch flow.

### Phase 5: Create frontend plugin skeleton

Create:

- types
- api
- context
- hook
- list
- form
- view

Use template naming patterns adapted to `ingest`.

### Phase 6: Register plugin

Read `pluginRegistry.ts` first.
Then add `ingest` the same way other plugins are registered.

Do not modify `App.tsx` unless absolutely necessary and verified.

### Phase 7: Wire end-to-end flow

Verify:

- create source
- list source
- view source
- edit source
- delete source
- run import
- fetch result appears in detail view

### Phase 8: Clean up

Check:

- naming consistency
- no guessed files
- no dead code
- no core hacks
- no direct UI fetch from source URL

---

## 16. Expected first UI experience

When the plugin opens, the user should see a list of configured ingest sources.

Each source row should show enough information to answer:

- what is this source
- what type is it
- is it active
- has it fetched successfully
- when was it last fetched

From there, user can:

- add a source
- open a source
- edit a source
- run import

When a source is opened, the detail view should show:

- URL
- type
- last status
- last error
- last fetched time
- last raw excerpt
- recent runs if available

That is the whole v1 goal.

---

## 17. Anti-patterns to avoid

Do not do any of these:

- building a parser registry for ten future use cases
- adding AI extraction in v1
- storing huge full HTML bodies without limit
- mixing source storage with domain content storage
- putting fetch logic in controller
- putting fetch logic in React components
- changing AppContext to hold ingest state
- modifying core loader logic unless plugin system truly requires it
- inventing generalized abstractions with no current use

---

## 18. Definition of done for v1

The plugin is done when all of the following work:

1. `ingest` appears as a registered plugin
2. user can create a source
3. user can edit a source
4. user can delete a source
5. user can open a source detail view
6. user can manually run an import
7. latest run metadata is saved
8. latest raw excerpt is visible in UI
9. errors are displayed cleanly
10. reusable backend service functions exist for later plugin reuse

---

## 19. Required reporting format from the agent

After each phase, report using this structure:

### Files read

- ...

### Files created

- ...

### Files modified

- ...

### Decisions made

- ...

### Blockers

- ...

### Next step

- ...

---

## 20. First action to take now

Do this first and nothing else:

1. Read the backend and frontend plugin templates
2. Read the existing mail plugin files
3. Read `client/src/core/pluginRegistry.ts`
4. Return a file inventory and implementation plan for `ingest`
5. Do not write code until file inventory is complete

## 21. Required completion behavior

When implementation is complete, stop and return a final delivery report.

Do not continue into new features.
Do not start building domain plugins.
Do not add speculative improvements unless they were explicitly requested.

### Final delivery report format

#### Status

Return one of these exact outcomes:

- `v1 complete according to guide`
- `blocked by unresolved dependency`
- `implementation completed with documented deviations`

#### Files read

List every file read before and during implementation.

#### Files created

List every new file created.

#### Files modified

List every existing file modified.

#### Architecture confirmation

Confirm all of the following explicitly:

- backend plugin follows template-based structure
- frontend plugin follows template-based structure
- plugin is registered correctly
- reusable backend service layer exists
- no unnecessary core file changes were made

#### Working flows verified

Confirm whether each flow works:

- create source
- list sources
- open source detail
- edit source
- delete source
- run import manually
- save run result
- display latest run metadata in UI

Use this exact format:

- `verified`
- `not verified`
- `blocked`

#### Known limitations in v1

List all intentionally excluded scope items, for example:

- no domain-specific normalization
- no source-specific parser strategies
- no AI extraction
- no public pages
- no scheduled sync
- no unlimited raw document storage

#### Deviations from the guide

If any deviation was necessary, list:

- what changed
- why it changed
- which file or system constraint caused it

If there were no deviations, write:

- `no deviations`

#### Blockers

List any blockers that prevented full completion.
If none, write:

- `no blockers`

#### Test notes

Summarize what was actually tested.
Do not claim anything was tested unless it was truly verified.

#### Recommended next step

Recommend exactly one next step only.
Do not implement it automatically.

### Mandatory stop rule

After returning the final delivery report, stop.
Do not continue with:

- domain plugin work
- parser expansion
- UI enhancements
- refactors outside the agreed scope

Wait for explicit user instruction before any further code changes.
