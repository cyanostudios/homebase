# Local ↔ production parity

**Default mode (until you say otherwise):** operational and config changes should apply to **both** local dev and Railway production.

**Code** is already shared via git (`homebase-v3.6` → merge to `main` → Railway deploy).

**Data / access** are separate unless you wire them as below.

---

## 1. One-time sync: local = prod (now)

### Prerequisites

In `.env.local` (never commit):

```bash
# Local Postgres main
DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/homebase_dev

# Production Neon MAIN (users, tenants, plugin access) — from Railway Variables
PROD_MAIN_DATABASE_URL=postgresql://...@....neon.tech/neondb?sslmode=require

# Optional: agents/scripts apply plugin changes to both DBs by default
LOCAL_PROD_PARITY=1
```

### Run sync

```bash
npm run sync:local-from-prod
# or: npm run sync:local-from-prod -- --email=user@homebase.se
```

This:

1. Copies `user@homebase.se` (password, role) from prod main → local main
2. Links the **same Neon tenant project** as production (`neon_connection_string`)
3. Copies `tenant_plugin_access` (enabled/disabled plugins)
4. Remaps `user_id` in the tenant DB if prod user id ≠ local user id

### After sync — required `.env.local` tweaks

```bash
TENANT_PROVIDER=neon
NEON_API_KEY=<same as Railway>
PUBLIC_CUPS_USER_ID=2
```

Use the prod owner user id for `PUBLIC_CUPS_USER_ID` (script prints it).  
Log in locally with the **same email/password as production**.

Cup **data** then comes from the shared Neon tenant DB (same as prod).  
Local-only schema (`TENANT_PROVIDER=local`) will **not** show prod cups.

### System-e-post (samma Resend som Mail)

Password reset uses server env vars, not Mail plugin DB. To send real emails locally (same as Railway):

```bash
RESEND_API_KEY=re_...
RESEND_FROM=noreply@your-verified-domain.se
FRONTEND_URL=http://localhost:3001
```

Without these, local dev shows the reset link on screen instead of sending mail.

`onboarding@resend.dev` only delivers to the Resend account owner — use a **verified domain** in `RESEND_FROM` to test real recipients (same as Railway prod).

**Mail plugin in sidebar:** not enabled by default for new tenants (`DEFAULT_DISABLED_PLUGINS`). Enable with `npm run set:tenant-plugins -- --email=... --enable=mail`. Superuser (`admin@`) sees all plugins including Mail via `ALL_DISCOVERED_PLUGINS`.

---

## 2. Ongoing: change both environments

| Change type            | Local                                                     | Production                                                    |
| ---------------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| App code               | `npm run dev` / commit                                    | Merge `main`, Railway deploy                                  |
| Plugin access          | `npm run set:tenant-plugins -- --both ...`                | same command                                                  |
| Plugin access (manual) | `npm run set:tenant-plugins -- ...` (uses `DATABASE_URL`) | `TARGET_DATABASE_URL='...' npm run set:tenant-plugins -- ...` |
| Main DB user/tenant    | `npm run copy:user-from-prod`                             | `npm run copy:user-to-main` (local → prod)                    |
| Migrations (main)      | `DATABASE_URL=local npm run migrate:...`                  | `PROD_MAIN_DATABASE_URL=... npm run migrate:...`              |
| Migrations (tenant)    | Use tenant connection from prod sync                      | Railway / Neon console                                        |

### Plugin access (`--both`)

```bash
npm run set:tenant-plugins -- --both --email=user@homebase.se --disable=matches,slots --enable=tasks
```

Requires `DATABASE_URL` (local main) and `PROD_MAIN_DATABASE_URL` (or `TARGET_DATABASE_URL`).

With `LOCAL_PROD_PARITY=1` in `.env.local`, `--both` is implied if you omit it.

After plugin changes: **log out/in** locally and on Railway so `/api/auth/me` refreshes.

---

## 3. Disable parity

Remove or set `LOCAL_PROD_PARITY=0` in `.env.local` and tell the agent you are back to **local-only** ops.

---

## 4. Safety

- Never commit `PROD_MAIN_DATABASE_URL`, passwords, or Neon URLs.
- `set-tenant-plugin-access` refuses to use localhost `DATABASE_URL` as “production” unless you pass `TARGET_DATABASE_URL` / `PROD_MAIN_DATABASE_URL`.
- Tenant DB writes affect real Cupappen data when synced to prod Neon — treat local login as production data.

See also: `docs/TENANT_USERS_AND_RBAC.md`, `docs/RAILWAY_HOMEBASE_SETUP.md`.
