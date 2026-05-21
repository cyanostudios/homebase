# Homebase Documentation

**Ingångspunkt** till aktuell dokumentation. Historik och release-noter: [`CHANGELOG.md`](CHANGELOG.md). Backlog efter maj 2026-städning: [`CLEANUP_DEFERRED_RISKS.md`](CLEANUP_DEFERRED_RISKS.md).

## Aktuell kodrad

- **`main`** — standard branch för utveckling och deploy (Railway Homebase, monolith API + SPA).
- **`homebase-v3.6`** / **`homebase-V3.5`** — äldre feature-branches; behålls på remote men är inte canonical.
- **Node:** `>=22.18 <23` (`package.json` → `engines`).

## Snabbstart (ny utvecklare)

| Ämne                                | Dokument                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Setup, struktur, kommandon          | [`DEVELOPMENT_GUIDE_V2.md`](DEVELOPMENT_GUIDE_V2.md)                         |
| Core services (`ServiceManager`)    | [`CORE_SERVICES_ARCHITECTURE.md`](CORE_SERVICES_ARCHITECTURE.md)             |
| Client/server-översikt              | [`CORE_ARCHITECTURE_V2.md`](CORE_ARCHITECTURE_V2.md)                         |
| Plugin-arkitektur (Action Registry) | [`PLUGIN_ARCHITECTURE_V3.md`](PLUGIN_ARCHITECTURE_V3.md)                     |
| Ny plugin (checklista)              | [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](NEW_PLUGIN_INTEGRATION_CHECKLIST.md) |
| Plugin-standarder (obligatoriskt)   | [`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`](PLUGIN_DEVELOPMENT_STANDARDS_V2.md)   |
| UI/UX (V3 + list shell v3.6)        | [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md)                     |
| Säkerhet, CSRF, `apiFetch`          | [`SECURITY_GUIDELINES.md`](SECURITY_GUIDELINES.md)                           |
| Deploy (allmänt)                    | [`DEPLOYMENT_V2.md`](DEPLOYMENT_V2.md)                                       |
| Railway Homebase                    | [`RAILWAY_HOMEBASE_SETUP.md`](RAILWAY_HOMEBASE_SETUP.md)                     |
| Cupappen (separat projekt)          | [`CUPPAPPEN_PATHS_AND_STORAGE.md`](CUPPAPPEN_PATHS_AND_STORAGE.md)           |
| Bundle-analys                       | [`FRONTEND_BUNDLE_ANALYSIS.md`](FRONTEND_BUNDLE_ANALYSIS.md)                 |

## Canonical dokument

- **Changelog:** `CHANGELOG.md`
- **SQL-migrationer:** `../server/migrations/README.md`
- **Engångs-migreringsskript (arkiv):** `../scripts/archive/README.md`
- **Plugin runtime (panel/hook-namn):** `PLUGIN_RUNTIME_CONVENTIONS.md`
- **Design-alignment (kopiera från slots/notes):** `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`
- **Mentions & cross-plugin UI:** `MENTIONS_AND_CROSS_PLUGIN_UI.md`
- **Tenant / RBAC:** `TENANT_USERS_AND_RBAC.md`
- **Cups cron (Railway):** `CUPS_AUTO_REFRESH_CRON.md`
- **Lessons learned / agent-regler:** `LESSONS_LEARNED.md`

## Kod som dokumentationen ska matcha

| Koncept                  | Verifierad plats i kod                   |
| ------------------------ | ---------------------------------------- |
| Server entry             | `server/index.ts`                        |
| Plugin discovery         | `plugin-loader.js` (root)                |
| Frontend API + CSRF      | `client/src/core/api/apiFetch.ts`        |
| Delad plugin-HTTP-klient | `client/src/core/api/createApiClient.ts` |
| Datum (sv-SE)            | `client/src/core/utils/dateFormat.ts`    |
| Ikoner i TS              | `client/src/types/icons.ts` (`AppIcon`)  |
| ESLint                   | `eslint.config.cjs` (flat config)        |
| Prod build + SPA         | `npm run build` → `dist/public/`         |
| Railway                  | `railway.toml`, `nixpacks.toml`          |

## Dokumentationspolicy

- **Vad som ändrats:** kort post i `CHANGELOG.md` med filreferenser.
- **Paths och branch-namn:** uppdatera canonical docs när kod flyttas; changelog-rader är historiska.
- **Radera eller arkivera** one-off rollout-docs när arbetet är klart (se changelog, inte duplicera checklistor).
- **Out of scope i docs:** `public-cups/` deploy, cup-Railway — beskrivs i `CUPPAPPEN_PATHS_AND_STORAGE.md`, inte som del av Homebase API-deploy.

## Borttagna / sammanslagna dokument (maj 2026)

| Tidigare fil                                                                       | Ersatt av                                                              |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `CONTACTS_LISTVIEW_STYLE_ROLLOUT_V36.md`                                           | `UI_AND_UX_STANDARDS_V3.md` §0                                         |
| `RAILWAY_CRON_EXAMPLE.md`                                                          | `CUPS_AUTO_REFRESH_CRON.md` § Railway Cron                             |
| `REFACTORING_EXISTING_PLUGINS.md` (700+ rader, felaktiga `ServiceManager`-exempel) | `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` + `CORE_SERVICES_ARCHITECTURE.md` |
