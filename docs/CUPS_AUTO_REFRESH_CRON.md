# Cups Auto-Refresh Cron

Automatically keeps the Cups plugin (and the public cupappen) up to date by
running the existing import + mark-and-sweep pipeline on a schedule.

**Recommended for Cupappen (≈20 district sources):** weekly — e.g. `0 3 * * 1` (Monday 03:00 UTC).  
Daily (`0 3 * * *`) is fine if you want fresher data; the app endpoint is the same either way.

District onboarding checklist: [`CUPS_DISTRICT_SOURCE_CATALOG.md`](CUPS_DISTRICT_SOURCE_CATALOG.md).

---

## How it works

```
Railway Cron (weekly recommended: 0 3 * * 1)
    │
    │  POST /api/cron/cups/refresh
    │  x-cron-secret: <CRON_SECRET>
    ▼
server/core/routes/cron.js          — validates secret, calls service
    │
    ▼
plugins/cups/services/cronRefresh.js
    │
    ├─ SELECT user_id, settings FROM user_settings
    │   WHERE category = 'cups'
    │     AND (settings->>'autoRefresh')::boolean = true
    │
    ├─ For each user → TenantContextService.getTenantContextByUserId()
    │                 → connectionPool.getTenantPool(tenantConnectionString)
    │
    └─ For each allowedIngestSourceId → importFromIngest()
           ├─ enforce allowlist (API: non-empty allowedIngestSourceIds must include source)
           ├─ fetch source URL (final URL re-validated; browser_fetch size-capped)
           ├─ parse cups
           ├─ upsert into tenant DB
           │    • matching cups: update content fields, set last_seen_at, clear deleted_at
           │    • location-only diff: keep manual location, still touch last_seen_at (and clear deleted_at)
           │    • new cups: create
           ├─ soft-delete cups not seen in this run (deleted_at = NOW())
           └─ hard-delete cups soft-deleted > 30 days ago
```

The `importFromIngest` function applies **safety guards** before running the sweep:

- Fetch must succeed (`fetchResult.ok = true`)
- At least 3 items must be parsed (`MIN_ITEMS_FOR_SWEEP = 3`)
- No save errors

This prevents accidental mass-deletion when a source is temporarily unavailable
or returns an empty/malformed response.

**Location-only skip:** If an existing cup matches the source item on all compared fields except `location`, import does **not** overwrite the stored location, but still updates `last_seen_at` (and clears `deleted_at` if the cup was soft-deleted). That keeps mark-and-sweep from treating the cup as missing. Implementation: `CupsModel.touchImportSeen` in `plugins/cups/model.js`.

**Allowlist (API):** When `allowedIngestSourceIds` in Cups settings is non-empty, `POST /api/cups/import-from-ingest/:sourceId` returns 403 if the source is not listed. An empty/missing allowlist still allows import of any tenant-owned ingest source (same as the Cups list UI). Cron only iterates the allowlist.

**`restored` counter:** Import responses include `restored` — cups that had `deleted_at` set and were cleared during this run (via full update or `touchImportSeen`).

---

## Per-tenant opt-in

Each user opts in individually via **Cups → Settings → Import → Auto refresh**.

- Default: **off**
- When enabled, the cron will process all `allowedIngestSourceIds` configured
  in the same settings panel.
- The toggle, like all cups settings, is stored as JSONB in `user_settings`
  (`category = 'cups'`, field `autoRefresh`). No DB migration is required.

---

## Environment variables

| Variable      | Description                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `CRON_SECRET` | Shared secret for the cron endpoint. Required in production. Generate with `openssl rand -base64 32`. |

Add to `.env.local` for local testing. Add to Railway Variables for production.

---

## Railway setup

1. Go to your Railway project → **Settings → Cron / Scheduled Tasks**.
2. Add a new cron job:
   - **Schedule (recommended):** `0 3 * * 1` (weekly, Monday 03:00 UTC)  
     Alternative: `0 3 * * *` (daily at 03:00 UTC)
   - **Command**:
     ```
     curl -fsS -X POST \
       -H "Content-Type: application/json" \
       -H "x-cron-secret: $CRON_SECRET" \
       https://$RAILWAY_PUBLIC_DOMAIN/api/cron/cups/refresh
     ```
3. Ensure `CRON_SECRET` is set in Railway Variables (same value as in the API service).
4. In the app: **Cups → Settings → Import** — select all district ingest sources and enable **Auto refresh**.

---

## Local testing

Make sure `CRON_SECRET` is set in your `.env.local`, then:

```bash
npm run cron:cups-refresh
```

This runs:

```bash
curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" http://localhost:3002/api/cron/cups/refresh
```

To limit to a single user (useful for debugging):

```bash
curl -fsS -X POST \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: $CRON_SECRET" \
  -d '{"userId": 1}' \
  http://localhost:3002/api/cron/cups/refresh
```

---

## Response format

```json
{
  "usersProcessed": 1,
  "usersSkipped": 0,
  "results": [
    {
      "userId": 1,
      "sourceId": "3",
      "fetched": true,
      "parsed": 42,
      "created": 2,
      "updated": 38,
      "skipped": 2,
      "softDeleted": 1,
      "restored": 0,
      "hardDeleted": 0,
      "errors": []
    }
  ],
  "totals": {
    "parsed": 42,
    "created": 2,
    "updated": 38,
    "skipped": 2,
    "softDeleted": 1,
    "hardDeleted": 0,
    "errors": 0
  }
}
```

Per-source objects come from `importFromIngest` (includes `restored`). Cron `totals` aggregate selected counters and may omit `restored` unless added later.

---

## Observability

All steps are logged via `Logger` (info/warn/error):

- `cups cron: starting auto-refresh` — run starts, shows `userId` or `"all opt-in"`
- `cups cron: found opt-in users` — number of users to process
- `cups cron: source done` — per-source summary (parsed/created/softDeleted/…)
- `cups cron: source failed` — per-source error with stack
- `cups cron: auto-refresh complete` — aggregate totals

In production these logs flow into Railway's log stream. Filter on `cups cron:`.

---

## Security

- The endpoint is **not** behind `requireAuth` or CSRF middleware — it is
  service-to-service only.
- The `x-cron-secret` header is compared with `crypto.timingSafeEqual` to
  prevent timing attacks.
- If `CRON_SECRET` is not configured the endpoint returns `503` immediately.
- Each user's import is isolated in its own try/catch; a broken tenant does
  not abort other users.
- The endpoint only runs already-opted-in imports — no cross-tenant mutations.

### Import API / ingest fetch (cleanup epic)

Verified behaviors (Security Approved for epic scope; residual risks below):

- Manual/API import uses session auth, CSRF, and plugin gate (`plugins/cups/routes.js`).
- Non-empty `allowedIngestSourceIds` is enforced server-side in `importFromIngest`.
- Ingest fetch re-validates the **final URL** after redirects (`assertFinalUrlPublicHttps`) and caps `browser_fetch` responses at the same ~2 MiB limit as `generic_http`.

**Known limitations / accepted residuals (TPM acknowledgment pending for delivery):**

| ID  | Limitation                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| A1  | If reading `user_settings` fails, allowlist check **fail-opens** (import allowed) and logs a warning.                |
| A2  | Empty/missing allowlist allows any tenant-owned ingest source (UI-compatible).                                       |
| A3  | SSRF guard is hostname-/URL-string based (no DNS pinning); redirect hops may contact a host before final-URL reject. |
| A4  | `browser_fetch` may buffer the full response before applying the size cap.                                           |

---

## Related files

| File                                                      | Role                                           |
| --------------------------------------------------------- | ---------------------------------------------- |
| `server/core/routes/cron.js`                              | HTTP endpoint, secret validation               |
| `plugins/cups/services/cronRefresh.js`                    | Core logic, tenant resolution, per-source loop |
| `plugins/cups/services/importFromIngest.js`               | Import, allowlist gate, mark-and-sweep         |
| `plugins/cups/model.js`                                   | Upsert, `touchImportSeen`, soft/hard delete    |
| `plugins/ingest/services/fetchSource.js`                  | HTTP fetch + final URL check                   |
| `plugins/ingest/services/fetchSourceBrowserFetch.js`      | Browser fetch + size cap + final URL check     |
| `plugins/ingest/services/fetchSourceSsrf.js`              | Shared final-URL SSRF helper                   |
| `client/src/plugins/cups/components/CupsSettingsView.tsx` | Auto-refresh toggle + import summary in UI     |
| `.env.example`                                            | `CRON_SECRET` variable documentation           |
