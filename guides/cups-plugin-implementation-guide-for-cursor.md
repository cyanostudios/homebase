# Cups Plugin Implementation Guide for Cursor

Use this guide to build a new Homebase plugin named **`cups`**.

This plugin must:

- follow the real Homebase plugin architecture already used in this codebase
- follow the latest frontend design/layout patterns used by `slots`
- use `ingest` as the source-fetch capability
- keep domain normalization inside `cups`, not inside `ingest`

This is a **domain plugin**.
It is not a generic import plugin.
It must own the `cups` domain model, list UI, detail UI, form UI, and import-to-domain flow.

---

## 1. Core rules

1. **Do not guess file contents**
   - Read files before modifying them.
   - If the real code differs from expectations, stop and report.

2. **Do not touch protected core files unless required**
   Protected examples:
   - `client/src/App.tsx`
   - `client/src/core/api/AppContext.tsx`
   - `client/src/core/pluginRegistry.ts`
   - `server/plugin-loader.js`
   - `server/core/*`

   If a protected file must be changed:
   - show what changed
   - keep the change minimal
   - explain why it was required

3. **Frontend must follow latest plugin design**
   The visual and structural reference is `slots`, not the raw template.

4. **Backend must follow actual domain-plugin style**
   The backend structure should match the current `matches` style:
   - `plugin.config.js`
   - `index.js`
   - `controller.js`
   - `model.js`
   - `routes.js`

5. **Do not move parsing into `ingest`**
   `ingest` fetches.
   `cups` understands cups.

6. **Do not overbuild v1**
   Do not add public pages.
   Do not add AI extraction.
   Do not add advanced per-site parser registries unless explicitly needed.

---

## 2. Architectural role of `cups`

The `cups` plugin should do this:

- store normalized cup records in its own table(s)
- let the user view/search/filter cups in a first-class Homebase UI
- provide an import action that uses `ingest`
- fetch full HTML via `ingestService`
- parse/normalize that HTML inside `cups`
- save real `cups` records

The `cups` plugin should **not**:

- become a generic import plugin
- duplicate source management from `ingest`
- scrape directly from React components
- rely on `rawExcerpt` as primary data

---

## 3. Required references already confirmed

Use these as the real patterns:

### Frontend visual/UX pattern

Use `slots` as the reference for:

- list page design
- settings/content view patterns
- detail panel card/section layout
- context richness
- toolbar/search/actions
- modern card-based detail UI
- content-layout usage
- dashboard widget style

### Backend domain plugin pattern

Use `matches` as the reference for:

- controller shape
- index/init structure
- model responsibilities
- routes style and validation
- plugin config style

### Shared fetch capability

Use `ingest` as the reference for:

- fetch capability access
- `ingestService.fetchSource(...)`
- `ingestService.fetchSourceFromRecord(req, record)`

Do not invent a different integration path.

---

## 4. Files to read before writing code

Read these first.

### Cups plugin target area

- any existing `client/src/plugins/cups/*` if it already exists
- any existing `plugins/cups/*` if it already exists

### Ingest reference

- `plugins/ingest/services/ingestService.js`
- `plugins/ingest/services/fetchSource.js`
- `plugins/ingest/services/fetchSourceBrowserFetch.js`
- `plugins/ingest/model.js`
- `plugins/ingest/controller.js`
- `client/src/plugins/ingest/*` only if needed to understand source selection UX

### Frontend visual reference

- `client/src/plugins/slots/context/SlotsContext.tsx`
- `client/src/plugins/slots/components/SlotsList.tsx`
- `client/src/plugins/slots/components/SlotForm.tsx`
- `client/src/plugins/slots/components/SlotView.tsx`
- `client/src/plugins/slots/components/SlotsSettingsView.tsx`
- `client/src/plugins/slots/api/slotsApi.ts`
- `client/src/plugins/slots/types/slots.ts`

### Backend domain reference

- `plugins/matches/plugin.config.js`
- `plugins/matches/index.js`
- `plugins/matches/controller.js`
- `plugins/matches/model.js`
- `plugins/matches/routes.js`

### Registry

- `client/src/core/pluginRegistry.ts`

Do not start implementing before these are read.

---

## 5. Plugin scope for v1

Build a working `cups` plugin where the user can:

- create a cup manually
- edit a cup manually
- delete a cup
- list cups
- open cup detail view
- import cup records from an `ingest` source
- save normalized cup records in the `cups` plugin
- see where a cup came from

Optional but recommended in v1:

- bulk delete
- duplicate support only if the UI pattern needs it and there is clear value
- simple settings page only if it serves a real purpose

Not required in v1:

- public pages
- AI parsing
- per-site parser marketplace
- scheduled automation
- PDF upload
- advanced dedupe workflow UI

---

## 6. Backend structure to create

Create:

- `plugins/cups/plugin.config.js`
- `plugins/cups/index.js`
- `plugins/cups/controller.js`
- `plugins/cups/model.js`
- `plugins/cups/routes.js`
- `plugins/cups/services/importFromIngest.js`
- `plugins/cups/services/parseCupSource.js`

Optional helper files only if needed:

- `plugins/cups/services/normalizeCupFields.js`
- `plugins/cups/services/cupImportUtils.js`

Do not create a large service tree unless actually needed.

---

## 7. Frontend structure to create

Create:

- `client/src/plugins/cups/types/cups.ts`
- `client/src/plugins/cups/api/cupsApi.ts`
- `client/src/plugins/cups/context/CupsContext.tsx`
- `client/src/plugins/cups/hooks/useCups.ts`
- `client/src/plugins/cups/components/CupsList.tsx`
- `client/src/plugins/cups/components/CupForm.tsx`
- `client/src/plugins/cups/components/CupView.tsx`
- `client/src/plugins/cups/components/CupsDashboardWidget.tsx`

Only create settings components if you truly need settings.

If there is no meaningful v1 settings scope:

- do not invent `CupsSettingsForm`
- do not invent `CupsSettingsView`

---

## 8. Naming rules

Use plural/singular naming that matches the current system.

### Context state

- `isCupPanelOpen`
- `currentCup`
- `panelMode`
- `validationErrors`
- `cups`

### Context actions

- `openCupPanel`
- `openCupForEdit`
- `openCupForView`
- `closeCupPanel`
- `saveCup`
- `deleteCup`

If you add bulk selection:

- `selectedCupIds`
- `toggleCupSelected`
- `selectAllCups`
- `clearCupSelection`

If you add import action:

- `importFromIngestSource`
- `loadImportPreview` only if truly needed

---

## 9. Backend data model for v1

Use a domain-specific cups table.

### Required table: `cups`

Recommended fields:

- `id`
- `name`
- `organizer`
- `location`
- `start_date`
- `end_date`
- `categories`
- `description`
- `registration_url`
- `source_url`
- `source_type`
- `ingest_source_id`
- `ingest_run_id`
- `external_id`
- `created_at`
- `updated_at`

Field notes:

- `categories`: simple text or JSON/text depending on existing DB conventions
- `source_url`: original source page where the cup came from
- `source_type`: optional source marker like `html`, `pdf`, `manual`
- `ingest_source_id`: reference to ingest source if imported
- `ingest_run_id`: reference to the run used for this import
- `external_id`: if the page has a stable identifier or generated hash

Keep the first schema pragmatic.

If your DB conventions favor text columns first, use text columns first.
Do not overdesign JSON structures until needed.

---

## 10. Backend responsibilities

### `plugin.config.js`

Define:

- `name: 'cups'`
- `routeBase: '/api/cups'`
- `requiredRole: 'user'`
- description matching domain intent

### `index.js`

Follow the `matches` pattern:

- create model
- create controller
- create routes
- return `{ config, router, model, controller }`

### `model.js`

Responsibilities:

- CRUD for cups
- import-save/upsert helpers
- row transformation

Required methods:

- `getAll(req)`
- `getById(req, id)` or equivalent
- `create(req, data)`
- `update(req, id, data)`
- `delete(req, id)`

For import flow, add:

- `createManyFromImport(req, items, importMeta)` or
- `upsertManyFromImport(req, items, importMeta)`

Do not put HTML parsing here.

### `controller.js`

Responsibilities:

- CRUD endpoints
- import endpoint
- error mapping/logging

Add methods:

- `getAll`
- `getById`
- `create`
- `update`
- `delete`
- `importFromIngest`

Keep it thin.

### `routes.js`

Follow the `matches` style with validation.

Add routes:

- `GET /`
- `GET /:id`
- `POST /`
- `PUT /:id`
- `DELETE /:id`

Import route:

- `POST /import-from-ingest/:sourceId`

Optional query/body:

- use source id from route
- or body param if your style is clearer
- but keep it explicit

Use:

- plugin gate
- CSRF on state-changing routes if consistent with your current backend conventions
- validation rules through existing middleware patterns

---

## 11. Import flow from ingest

This is the most important part.

### Required backend import flow

The `cups` plugin must import like this:

1. load source information from `ingest` or accept an ingest source id
2. fetch content through `ingestService`
3. receive normalized fetch result including full `bodyText`
4. parse the full HTML inside `cups`
5. map extracted entries to `cups` domain records
6. save cups via `cups` model
7. return summary to frontend

Do not parse `rawExcerpt`.
Use `bodyText`.

### Use this reusable ingest entrypoint

A future domain plugin should call:

- `ingestService.fetchSource(...)`
  or
- `ingestService.fetchSourceFromRecord(req, record)`

Prefer the ingest service function that best matches your actual flow.
Do not bypass it with a new fetch implementation in `cups`.

---

## 12. Cup parsing responsibilities

Create parsing inside `cups`, for example in:

- `services/parseCupSource.js`

It should:

- accept full fetched HTML
- return an array of normalized cup payloads

The parser is domain-specific.
It should extract fields like:

- name
- organizer
- date or date range
- categories
- location
- registration URL
- description if present

Do not add AI parsing in v1.

Do not create a huge parser framework in v1.

Implement the minimum needed structure so later you can add:

- one parser per source family
- one parser per page shape
  only when needed

Suggested simple design:

- `parseCupSource({ html, sourceUrl, sourceType })`
- internally choose one parsing approach
- if later needed, branch by source host or page signature

---

## 13. Frontend design requirements

Use `slots` as the design/layout reference.

That means:

### `CupsList`

Should feel like `SlotsList` in structure and polish:

- search
- sortable list or table
- top actions
- clean toolbar
- use modern card/table design
- consistent spacing and typography
- latest styling conventions from slots

Do not fall back to the old minimal template look.

### `CupForm`

Should follow the richer `SlotForm` style where appropriate:

- structured sections
- strong labels
- proper card/detail sections
- unsaved changes handling if already standard in your plugin system
- no cramped basic-template UI

But keep the form simpler than slots unless real cup complexity requires more.

### `CupView`

Should follow `SlotView` style:

- `DetailLayout`
- right-side metadata / actions card pattern if applicable
- main info card
- sectioned content
- modern `DetailSection` usage
- visually aligned with recent plugins

### `CupsDashboardWidget`

Optional but recommended if your registry expects it.
Keep it lightweight like recent widgets.

---

## 14. Cups frontend behavior

### `CupsList`

Must support:

- open cup detail
- add cup
- search/filter basic records
- optional import action if UX is clear

A good v1 top action set could be:

- Add Cup
- Import from Ingest

Do not overfill the toolbar.

### `CupForm`

Suggested fields:

- name
- organizer
- location
- start date
- end date
- categories
- registration URL
- description
- source URL
- ingest source id only if needed internally

### `CupView`

Must show:

- name
- organizer
- location
- date range
- categories
- registration URL
- source URL
- import/source metadata if available

### Import UX

Do not overbuild the import UI.

For v1, one of these is enough:

- a small import button that opens a selector/modal of ingest sources
- or a simple dedicated import action in the list page

Keep the UI minimal but usable.

---

## 15. Registry integration

Add the new plugin to:

- `client/src/core/pluginRegistry.ts`

Follow the style used by `slots`, `matches`, `ingest`, etc.

Register:

- Provider
- hook
- panelKey
- components
- navigation
- optional dashboard widget
- displayPrefix if your system uses one

Suggested name:

- `cups`

Suggested icon:

- choose one already consistent with your icon set
- keep it semantically aligned with cups/tournaments

Do not alter registry architecture.

---

## 16. What to copy from slots vs what not to copy

### Copy from slots

Copy the spirit and layout patterns:

- card-based detail presentation
- stronger context design
- list toolbar behavior
- settings/content-view conventions only if you actually need them
- modern visual density and spacing
- detail-side quick actions pattern where useful

### Do not blindly copy from slots

Do not copy:

- message/email flows
- slot-specific contacts/mentions complexity
- booking-specific logic
- bulk property dialogs
- slot export machinery unless cups actually needs it
- match-linked slot behavior

Only reuse what matches the cups domain.

---

## 17. What to copy from matches backend vs what not to copy

### Copy from matches

Copy:

- backend plugin structure
- controller thinness
- model-driven validation/storage pattern
- route organization
- plugin init pattern
- CRUD conventions

### Do not blindly copy from matches

Do not copy:

- sport/format validation
- match-specific fields
- bulk delete unless cups really needs it now
- match-specific naming and business rules

---

## 18. Recommended implementation order

### Phase 1: read and inventory

Read all required reference files.
Return:

- files read
- proposed cups file list
- proposed schema
- import flow outline

No code changes yet.

### Phase 2: backend skeleton

Create:

- plugin config
- index
- controller
- model
- routes

No parsing yet.

### Phase 3: cups table / schema plan

Before implementation depends on it, define:

- cups table
- any migration needed
- field names and shapes

If migration infrastructure is needed, follow existing project practice.
Do not guess migration conventions.

### Phase 4: frontend skeleton

Create:

- types
- API
- context
- hook
- list
- form
- view
- widget

Use `slots`-level design, not the old raw template look.

### Phase 5: CRUD flow

Implement:

- create
- list
- detail
- edit
- delete

Verify manual cups work first.

### Phase 6: ingest integration

Add:

- backend import service using `ingestService`
- parse full `bodyText`
- map to cups
- save results
- expose import endpoint

### Phase 7: frontend import action

Add:

- a simple import action from the cups UI
- minimal UX to choose or pass an ingest source
- result summary after import

### Phase 8: cleanup

Remove dead code.
Confirm behavior.
Stop.

---

## 19. Explicit non-goals

Do not do these in this task:

- no public cups website
- no AI extraction
- no PDF upload system
- no giant parser framework
- no generic content platform abstraction
- no ingest redesign
- no App.tsx refactor as part of this work
- no AppContext refactor
- no speculative multi-domain abstraction

---

## 20. Review checklist

Before finishing, verify:

1. Does `cups` own its own domain model?
2. Does `cups` use `ingest` instead of duplicating fetch logic?
3. Is parsing done inside `cups`, not `ingest`?
4. Does the frontend look consistent with `slots`-era plugins?
5. Does the backend structure follow the real `matches` plugin style?
6. Were core file changes kept minimal?
7. Is `rawExcerpt` treated only as preview, not primary source data?
8. Can a future source-specific parser be added later without rewriting the plugin?

If any answer is no, revise before finishing.

---

## 21. Final delivery format

When finished, return this exact style of report.

### Status

One of:

- `cups plugin implementation completed`
- `blocked by missing dependency`
- `completed with documented deviations`

### Files read

List all files read.

### Files created

List all new files created.

### Files modified

List all existing files modified.

### Architecture confirmation

Confirm explicitly:

- backend follows current domain-plugin structure
- frontend follows current slots-era plugin style
- ingest is reused through service layer
- cups parsing is domain-owned
- no unnecessary core rewrites were made

### Working flows verified

Mark each as:

- `verified`
- `not verified`
- `blocked`

Required rows:

- create cup
- list cups
- open cup detail
- edit cup
- delete cup
- import cups from ingest source
- parse full fetched HTML
- save imported cup records
- display imported cup data in UI

### Known limitations in v1

List intentional exclusions.

### Deviations

If none, write:

- `no deviations`

### Blockers

If none, write:

- `no blockers`

### Recommended next step

Recommend exactly one next step only.

### Mandatory stop rule

After the final report, stop.
Do not continue with:

- public pages
- parser expansion
- extra refactors
- new plugin work

Wait for explicit instruction.

---

## 22. First action now

Do this first:

1. Read the required reference files
2. Inventory whether any `cups` plugin files already exist
3. Propose the exact cups file list
4. Propose the cups schema
5. Propose the import-from-ingest flow
6. Do not write code until the inventory is complete
