# Core Services Architecture (Current)

This document describes the current server-side core service model used by Homebase.

## Scope

The canonical implementation is `server/core/ServiceManager.js`. This is the runtime source of truth for what services exist and how they are initialized.

## ServiceManager today

`ServiceManager` is a singleton that initializes and exposes these services:

- `logger` (console adapter by default)
- `tenant` (provider: `local` or `neon`)
- `connectionPool` (provider: `postgres`)
- `database` (PostgreSQL adapter, request-aware via `req.tenantPool`)

It also exposes:

- `getMainPool()` for main/auth metadata DB operations
- `get(serviceName, req?)`
- `override(serviceName, service)` and `reset()` for testing
- `shutdown()` for graceful pool teardown

## Request-aware database access

Database service resolution is request-aware:

- If `get('database', req)` is called, `req.tenantPool` is used when available.
- If no request is passed, the default main pool is used.

This lets plugin routes use tenant-bound DB access while still allowing system-level operations when needed.

## Provider model in current code

Current providers in active use:

- **Logger:** console
- **Tenant:** `local` or `neon` (`TENANT_PROVIDER` or inferred from `NEON_API_KEY`)
- **Connection pool:** postgres
- **Database:** postgres adapter

`ServiceManager` does not currently initialize generic runtime services like queue/cache/realtime/search/email/storage via `get(...)`.

## Plugin usage pattern

Typical plugin/server usage:

```js
const ServiceManager = require('../../server/core/ServiceManager');

const database = ServiceManager.get('database', req);
const logger = ServiceManager.get('logger');
```

For operations that must target main/auth metadata DB (not tenant pool):

```js
const mainPool = ServiceManager.getMainPool();
```

## Relation to plugin architecture

- Plugin business logic remains in plugin `model.js` / `controller.js`.
- Core concerns (pool lifecycle, tenant provider resolution, logger initialization) are centralized in `ServiceManager`.
- Tenant-aware routing helpers (for example public share routing) may use `getMainPool()` explicitly.

## Notes for docs consistency

- Avoid documenting `useCoreServices()` for client code; that hook does not exist in current codebase.
- Avoid listing queue/cache/realtime/search/email/storage as active `ServiceManager` runtime services unless they are actually wired.

## See also

- `docs/CORE_ARCHITECTURE_V2.md`
- `server/core/README.md`
- `docs/SECURITY_GUIDELINES.md`
