# Tenant Users and RBAC

**Last updated:** February 2026

This document describes the multi-user-per-tenant architecture: several users (User, Editor, Admin) per tenant with shared plugin access and tenant-scoped roles. It also covers **legacy compatibility**: login and plugin access work even if the new migration has not been run.

---

## 1. Overview

- **One user belongs to exactly one tenant** (e.g. one company = one tenant, with many users).
- **Plugin access is per tenant** (shared for all members).
- **Tenant roles:** `user`, `editor`, `admin` (hierarchy: user &lt; editor &lt; admin).
- **Platform role** (unchanged): `user` | `superuser` (system-wide admin).
- **Backward compatible:** Existing single-owner accounts keep working; login and plugin checks work with or without the new DB tables.

---

## 2. Database (main DB only)

### 2.1 New / changed tables

- **`tenants`**
  - Added: `owner_user_id` (references `users.id`, UNIQUE). Backfilled from `user_id`. Kept `user_id` for legacy.
  - Semantics: one row per tenant; `owner_user_id` = account owner; `user_id` kept for backward compatibility.

- **`tenant_memberships`**
  - `id`, `tenant_id` (FK tenants), `user_id` (FK users, **UNIQUE** = one tenant per user), `role` ('user'|'editor'|'admin'), `status` ('active'|'disabled'|'invited'), `created_at`, `created_by`.

- **`tenant_plugin_access`**
  - `id`, `tenant_id`, `plugin_name`, `enabled`, `granted_by_user_id`, `granted_at`, UNIQUE(tenant_id, plugin_name).

### 2.2 Migration and backfill

- **Script:** `npm run migrate:tenant-memberships`
- **File:** `scripts/run-tenant-memberships-migration.js`
- **Runs on:** main database (`DATABASE_URL`).
- **Actions:**
  1. Add `owner_user_id` to `tenants`, backfill from `user_id`, set NOT NULL, create UNIQUE index.
  2. Create `tenant_memberships` and `tenant_plugin_access`.
  3. Backfill: one row in `tenant_memberships` per existing tenant (owner = admin).
  4. Backfill: copy `user_plugin_access` → `tenant_plugin_access` per tenant (by owner).

See `scripts/db/README.md` for run instructions. Safe to run multiple times (idempotent).

### 2.3 Legacy behaviour (no migration run)

- If `tenant_memberships` or `owner_user_id` do not exist, login and tenant resolution use **legacy path**: `tenants WHERE user_id = $1` and `user_plugin_access` for plugins (see section 7).

---

## 3. Session and auth flow

### 3.1 Session fields (after login / signup)

| Field                    | Description                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `user`                   | `{ id, email, role, plugins }` — logged-in user (actor).                                                                                  |
| `tenantConnectionString` | Connection string for tenant DB (unchanged).                                                                                              |
| `tenantId`               | Main DB tenant id (from `tenants.id`).                                                                                                    |
| `tenantRole`             | `'user'` \| `'editor'` \| `'admin'`.                                                                                                      |
| `tenantOwnerUserId`      | Owner user id for current tenant.                                                                                                         |
| `currentTenantUserId`    | **Tenant data scope:** used for all tenant DB queries (filter by `user_id`). Set to **owner** id so all members see the same tenant data. |

### 3.2 Login flow

1. Validate credentials (UserService).
2. Resolve tenant context (TenantContextService):
   - Prefer `tenant_memberships` + `tenants` (with `owner_user_id`).
   - Fallback: `tenants` by `user_id` or `owner_user_id`.
   - **Legacy:** on error (e.g. missing tables), use `tenants WHERE user_id = $1`.
3. Resolve plugins: `tenant_plugin_access` for tenant, fallback `user_plugin_access` for owner; **legacy:** on error use `user_plugin_access` for user.
4. Set session (see table above). `currentTenantUserId` = `tenantOwnerUserId` so existing tenant tables (filtered by `user_id`) show shared data for all members.

### 3.3 Signup flow (new account = tenant owner)

1. Create user, create tenant DB (TenantService), insert into `tenants` (with `owner_user_id` if column exists).
2. Insert into `tenant_memberships` (owner, role admin), insert into `tenant_plugin_access` from selected plugins.
3. Still insert into `user_plugin_access` for backward compatibility.
4. Auto-login with session as above; `currentTenantUserId` = new user id (owner).

### 3.4 GET /api/auth/me

- Returns `user`, `currentTenantUserId`, `tenantId`, `tenantRole`, `tenantOwnerUserId`.
- Plugins for “current tenant” are resolved via TenantContextService (owner = `currentTenantUserId`), so superuser switch-tenant still gets the switched tenant’s plugins.

### 3.5 Admin switch-tenant (superuser)

- `POST /api/admin/switch-tenant` with `{ userId }` (owner id).
- Session: `tenantConnectionString`, `currentTenantUserId`, `tenantId`, `tenantRole`, `tenantOwnerUserId` updated for the target tenant.
- Lookup uses `tenants WHERE user_id = $1 OR owner_user_id = $1`.

---

## 4. Plugin access

- **requirePlugin(pluginName)** (in `server/index.ts`):
  - If `req.session.tenantId` is set: try `tenant_plugin_access` for (tenant_id, plugin_name). On **error** (e.g. table missing), fall through.
  - Then check `user_plugin_access` for `req.session.user.id`.
  - Superuser bypass unchanged.
- So plugin access works **with or without** the migration (legacy = user_plugin_access only).

---

## 5. Tenant RBAC

### 5.1 Middleware

- **requireTenantRole(allowedRoles)** in `server/core/middleware/authorization.js`.
- `allowedRoles`: e.g. `['admin']`, `['editor','admin']`, `['user','editor','admin']`.
- Hierarchy: user (0) &lt; editor (1) &lt; admin (2). User passes if their `tenantRole` level ≥ minimum level of `allowedRoles`.
- **Superuser** (platform role) always passes.
- Returns 401 if no session/user, 403 with `{ error, required }` if role insufficient.

### 5.2 Plugin SDK

- In `plugin-loader.js`, `context.middleware.requireTenantRole` is exposed so plugins can use e.g. `requireTenantRole(['admin'])` on routes.

### 5.3 Context helpers (packages/core)

- `Context.getTenantRole(req)`
- `Context.hasTenantRoleAtLeast(req, 'editor')` (hierarchy check).

---

## 6. Team management API

- **Base path:** `/api/team` (core routes).
- **Service:** `server/core/services/team/TeamService.js` (uses main DB pool for `tenant_memberships` / `users`).

| Method | Path                     | Who             | Description                                                                                        |
| ------ | ------------------------ | --------------- | -------------------------------------------------------------------------------------------------- |
| GET    | /team/users              | editor or admin | List members (tenant_id from session).                                                             |
| POST   | /team/users              | admin           | Add member. Body: `email`, `password?`, `role?`. New user created if needed; membership with role. |
| PATCH  | /team/users/:userId/role | admin           | Update member role. Body: `{ role }`.                                                              |
| DELETE | /team/users/:userId      | admin           | Remove membership (user row remains).                                                              |

All require `req.session.tenantId`; TeamService is constructed with main pool so queries hit main DB, not tenant DB.

---

## 7. Activity log

- **Insert:** `user_id` in `activity_log` = **tenant scope** (`req.session.currentTenantUserId`) so all tenant activity is under one scope.
- **Metadata:** `actor_user_id`, `actor_email` added when present so “who did what” is visible.
- **List:** Filter by same scope user_id so all tenant activity is visible to members.

---

## 8. Legacy compatibility (login without migration)

So that you can **log in even if the new migration has not been run**:

1. **TenantContextService.getTenantContextByUserId**
   - Tries `tenant_memberships` + `tenants` (with `owner_user_id`). On **error** (e.g. relation/column missing), runs legacy: `tenants WHERE user_id = $1`, returns `tenantId`, `tenantRole: 'admin'`, `tenantConnectionString`, `tenantOwnerUserId: user_id`.

2. **TenantContextService.getTenantPluginNames**
   - Tries `tenant_plugin_access`. On error or empty, uses `user_plugin_access` for `ownerUserId`.

3. **AuthService.login**
   - Wraps tenant context and plugin lookups in try/catch; on plugin failure uses `userService.getPluginAccess(user.id)`.

4. **requirePlugin**
   - Wraps `tenant_plugin_access` query in try/catch; on error falls back to `user_plugin_access`.

Result: **401 on GET /api/auth/me** when not logged in is expected; **login (POST /api/auth/login) and plugin access work with or without the migration.**

---

## 9. Constants and config

- **server/core/config/constants.js**
  - `USER_ROLES`: `user`, `superuser` (platform).
  - `TENANT_ROLES`: `user`, `editor`, `admin`.

---

## 10. Files touched (reference)

| Area                | Files                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Migration           | `scripts/run-tenant-memberships-migration.js`, `scripts/db/README.md`, `package.json` (script)                                 |
| Constants           | `server/core/config/constants.js` (TENANT_ROLES)                                                                               |
| Tenant context      | `server/core/services/tenant/TenantContextService.js`                                                                          |
| Auth                | `server/core/services/auth/AuthService.js`, `server/core/routes/auth.js`                                                       |
| Admin               | `server/core/services/admin/AdminService.js`, `server/core/routes/admin.js`                                                    |
| Plugin access       | `server/index.ts` (requirePlugin)                                                                                              |
| RBAC                | `server/core/middleware/authorization.js`, `plugin-loader.js`, `packages/core/src/Context.js`                                  |
| Team API            | `server/core/services/team/TeamService.js`, `server/core/routes/team.js`, `server/core/routes/index.js`                        |
| Activity log        | `server/core/services/activity-log/ActivityLogService.js`                                                                      |
| User/tenant cleanup | `server/core/services/user/UserService.js`, `server/core/services/tenant/providers/NeonTenantProvider.js`                      |
| Tests               | `server/core/middleware/__tests__/authorization.test.js`, `server/core/services/tenant/__tests__/TenantContextService.test.js` |

---

## 11. What to do next (suggested)

- Run migration when ready: `npm run migrate:tenant-memberships`.
- Add UI for team management (list members, invite, change role, remove) using `/api/team/*`.
- Optionally add `actor_user_id` (and `actor_email`) as columns on `activity_log` in a **tenant** migration for richer audit (metadata already carries this today).
- Define concrete permissions per role later (e.g. “editor can edit contacts”) and optionally `requirePermission('contacts.write')` on top of `requireTenantRole`.

---

## 12. Tenant providers & connection pools (implementation)

Det här är den praktiska implementationen som ligger under “tenant context” ovan.

### 12.1 Tenant provider (`TENANT_PROVIDER`)

**Kod:**

- `server/core/services/tenant/providers/NeonTenantProvider.js`
- `server/core/services/tenant/providers/LocalTenantProvider.js`

**Syfte:** Byta strategi för hur en tenant provisioneras (t.ex. Neon project/db-per-tenant vs local/schema-per-tenant) utan att plugins behöver ändras.

**Konfiguration (exempel):**

```bash
TENANT_PROVIDER=neon   # production
NEON_API_KEY=...

TENANT_PROVIDER=local  # local dev
```

### 12.2 Connection pools (tenantPool)

**Kod:**

- `server/core/services/connection-pool/ConnectionPoolService.js`
- `server/core/services/connection-pool/providers/PostgresPoolProvider.js`

**Syfte:** Ge varje request ett korrekt `req.tenantPool` för tenantens connection string och hantera pool-livscykel (återanvändning/cleanup/shutdown).

**Viktigt:** Alla tenant-scopade queries går via `req.tenantPool` (eller core Database-adapter som använder den), och filtrerar med `user_id = currentTenantUserId` för att ge delad data för alla medlemmar i tenant.
