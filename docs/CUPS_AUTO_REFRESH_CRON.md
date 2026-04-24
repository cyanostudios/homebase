# Cups Auto-Refresh Cron

Automatically keeps the Cups plugin (and the public cupappen) up to date by
running the existing import + mark-and-sweep pipeline on a daily schedule.

---

## How it works

```
Railway Cron (0 3 * * *)
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
           ├─ fetch source URL
           ├─ parse cups
           ├─ upsert into tenant DB (sets last_seen_at = NOW(), clears deleted_at)
           ├─ soft-delete cups not seen in this run (deleted_at = NOW())
           └─ hard-delete cups soft-deleted > 30 days ago
```

The `importFromIngest` function applies **safety guards** before running the sweep:

- Fetch must succeed (`fetchResult.ok = true`)
- At least 3 items must be parsed (`MIN_ITEMS_FOR_SWEEP = 3`)
- No save errors

This prevents accidental mass-deletion when a source is temporarily unavailable
or returns an empty/malformed response.

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
   - **Schedule**: `0 3 * * *` (daily at 03:00 UTC)
   - **Command**:
     ```
     curl -fsS -X POST \
       -H "Content-Type: application/json" \
       -H "x-cron-secret: $CRON_SECRET" \
       https://$RAILWAY_PUBLIC_DOMAIN/api/cron/cups/refresh
     ```
3. Ensure `CRON_SECRET` is set in Railway Variables (same value as in the API service).

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

---

## Related files

| File                                                      | Role                                           |
| --------------------------------------------------------- | ---------------------------------------------- |
| `server/core/routes/cron.js`                              | HTTP endpoint, secret validation               |
| `plugins/cups/services/cronRefresh.js`                    | Core logic, tenant resolution, per-source loop |
| `plugins/cups/services/importFromIngest.js`               | Existing import + mark-and-sweep (unchanged)   |
| `client/src/plugins/cups/components/CupsSettingsView.tsx` | Auto-refresh toggle in UI                      |
| `.env.example`                                            | `CRON_SECRET` variable documentation           |
