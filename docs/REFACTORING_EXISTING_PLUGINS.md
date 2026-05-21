# Refactoring existing plugins

> **Status (2026-05):** Legacy migration till `@homebase/core` och V2 tenant-DB är i stort sett **klar** för contacts, notes, tasks, estimates, m.fl. Detta dokument är en **kort referens**, inte en steg-för-steg-guide med gamla `ServiceManager.get('storage')`-exempel (de tjänsterna finns inte i runtime).

## Canonical patterns

### Backend

- **DB:** `Database.get(req)` från `@homebase/core` i `model.js` — tenant-isolation via `req.tenantPool`, ingen manuell `user_id`-filter i varje query.
- **Logg:** `Logger` från `@homebase/core`.
- **Auth-kontext:** `req.session.currentTenantUserId` / plugin-gate `requirePlugin` via `plugin-loader` context.
- **Validering:** `validateRequest` + `commonRules` i `server/core/middleware/validation.js`.
- **Plugin-init:** en funktion `initializeXPlugin(context)` exporterad från `plugins/<name>/index.js` (se `NEW_PLUGIN_INTEGRATION_CHECKLIST.md`).

### Frontend

- **HTTP:** muterande anrop via `apiFetch` (CSRF när `ENABLE_CSRF=true`).
- **Plugin-API:** föredra `createApiClient('/<plugin>')` från `client/src/core/api/createApiClient.ts` (se `CLEANUP_DEFERRED_RISKS.md` för plugins som ännu inte migrerats).
- **Panel:** `PLUGIN_RUNTIME_CONVENTIONS.md` + inline Save/Cancel på create/edit (`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12).

### Core services (vad som faktiskt finns)

Se **`CORE_SERVICES_ARCHITECTURE.md`**: `ServiceManager` exponerar `logger`, `tenant`, `connectionPool`, `database` — inte generiska `storage` / `email` / `queue` via `get()`.

Filer, mail och cups hanterar storage/e-post i **plugin-specifik kod** eller egna API-lager.

## När du ändå refaktorerar ett plugin

1. Läs **`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`** och **`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`**.
2. Kör `npm run check`, `npm test`, manuell smoke (list/create/edit/view/settings).
3. Dokumentera beteendeförändringar i **`CHANGELOG.md`**.

## Historik

Långa migrationschecklistor och exempel med `ServiceManager.get('email')` / `get('storage')` togs bort maj 2026 — de matchade inte `server/core/ServiceManager.js` och ledde fel vid copy-paste.
