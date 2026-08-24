# Requests — operator notes

Plugin id: **`requests`**. Collects internal and public requests; optional **hybrid routing** into Garments lists (staff-confirmed).

## Enable (local)

Requests is typically already granted. After schema changes:

```bash
npm run migrate:requests-plugin-routing
npm run migrate:requests-first-viewed-at
npm run migrate:requests-response-due   # if not already applied
```

Then **log out and log in** if plugin access changed. Production / `--both` only when you explicitly request release (Release Discipline).

## Surfaces

| Surface           | URL / API                                      | Purpose                                                                      |
| ----------------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| Staff list / view | `/requests`                                    | Authenticated CRUD, filters, Send to list when plugin-linked; unopened badge |
| Settings          | Requests settings (request types)              | Type keys; optional garments link + target list + intake schema              |
| Public form       | `/public/request`                              | Conversational wizard; branding via `PUBLIC_REQUESTS_USER_ID`                |
| Public API        | `/api/requests/public/{teams,branding,submit}` | Unauthenticated; rate-limited                                                |

## Plugin routing → Garments (verified)

Hybrid flow: public intake stores structured data; **staff** sends to a garment list. No auto-routing.

1. **Settings** — For a request type, optionally set `plugin: 'garments'`, pick a garment list (`targetListId`), and choose intake fields from the garments allowlist (`name`, sizes, jersey fields, `initials`, `comment`). Legacy type strings coerce to `{ key }`.
2. **Public branding** — Linked types expose `plugin` + `intakeSchema` only; **never** `targetListId`.
3. **Public submit** — When the type is linked, the form shows intake fields; body may include `extra_data`. Server validates against the allowlist, snapshots `plugin_target` / `plugin_target_id`, stores `extra_data`. Response: **`{ success: true }` only**.
4. **Send to list** — Staff `POST /api/requests/:id/send-to-list` (CSRF) creates a `garment_list_person`, records `plugin_routed_*`, sets status **`completed`**. Requires garments plugin access. **409** if already routed.

### Migration

| File                                   | Effect                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `144-requests-plugin-routing.sql`      | Adds `plugin_target`, `plugin_target_id`, `extra_data`, `plugin_routed_at`, `plugin_routed_entity_id` |
| `145-requests-add-first-viewed-at.sql` | Adds `first_viewed_at` (see [Unopened requests](#unopened-requests-first-viewed))                     |

Run: `npm run migrate:requests-plugin-routing` and `npm run migrate:requests-first-viewed-at` (tenant DBs; existing tenants need each once).

### Architecture

Thin adapters under `plugins/requests/pluginTargets/` (`registry.js`, `garments.js`). ADR: [`docs/ai/adr/REQUEST_PLUGIN_ROUTING.md`](ai/adr/REQUEST_PLUGIN_ROUTING.md). Garments operator notes: [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md).

## Security residuals (TPM-accepted)

| ID  | Summary                                              |
| --- | ---------------------------------------------------- |
| S3  | Non-atomic create person + mark routed               |
| S4  | Unencrypted `extra_data` (same class as garment PII) |
| S5  | Public description sanitizer optional hardening      |

**Local first; no prod** without an explicit release.

## Unopened requests (first viewed)

Staff inbox indicator for requests nobody on the tenant has opened yet.

1. **Storage** — `first_viewed_at` (TIMESTAMPTZ, nullable). Null = unopened for all staff.
2. **Mark viewed** — `POST /api/requests/:id/mark-viewed` (CSRF, authenticated). Sets `first_viewed_at = COALESCE(first_viewed_at, NOW())` (first open wins; idempotent).
3. **UI** — Red sidebar badge with count when any request has `firstViewedAt === null`. Green row highlight (`bg-green-50`) for unopened rows (same class as recently duplicated items).
4. **When it fires** — Desktop quick-context preview **or** full view open; not on hover alone.

### Migration

| File                                   | Effect                                       |
| -------------------------------------- | -------------------------------------------- |
| `145-requests-add-first-viewed-at.sql` | Adds `first_viewed_at` + index on `requests` |

Run: `npm run migrate:requests-first-viewed-at` (tenant DBs).

**Note:** Without migration, `mark-viewed` fails at runtime; badge counts all requests as unopened until column exists.

### Security (verified)

- **Auth:** `requirePlugin('requests')` + session; tenant DB via `Database.get(req)`.
- **CSRF:** required on `POST …/mark-viewed`.
- **Scope:** Any staff with requests access may mark any request in the tenant (shared inbox — intentional).
- **Response:** Returns full request row (same exposure class as `GET /api/requests/:id`).
- **Residual S-MV-1 (info):** No dedicated rate limit; acceptable for authenticated low-impact mutation.

Plugin routing residuals **S3 / S4 / S5** (send-to-list / `extra_data`) — see [Security residuals](#security-residuals-tpm-accepted) above.
