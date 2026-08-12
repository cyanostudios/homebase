# Development Guide

## Project Overview

Homebase is a modular plugin-based platform with service abstraction architecture. The system enables parallel team development with zero conflicts while maintaining enterprise-grade security and performance.

---

## Architecture Philosophy

### Modular Service System

- **Service Abstraction** - Infrastructure swappable via configuration
- **Plugin Isolation** - Each plugin manages its own state independently
- **Security By Default** - Enforcement at multiple layers
- **Zero Conflicts** - Teams can develop plugins in parallel

### Key Benefits

- Infrastructure changes don't require code changes
- Security enforced automatically through core services
- New plugins integrate automatically
- Testing simplified with mock adapters

---

## Tech Stack

### Frontend

- **React 18** + TypeScript + Vite
- **Modular Contexts** - Plugin-specific state management
- **Responsive Design** - Mobile-first with conditional rendering
- **Universal Keyboard Navigation** - Space + Arrow keys

### Backend

- **Express.js** + PostgreSQL
- **ServiceManager** - Core service orchestration
- **Plugin-loader** - Automatic plugin discovery
- **Security Middleware** - Authentication, CSRF, rate limiting

### Infrastructure

- **Development:** PostgreSQL with session store
- **Production:** Railway + Neon databases
- **Storage:** Configurable (local, S3, R2, Scaleway)
- **Email:** Configurable (SMTP, SendGrid, Resend)

---

## Project Structure

```
homebase/
├── vite.config.ts          # Vite (UI build + optional bundle analyzer)
├── package.json            # Single root package (engines: Node >=22.18 <23)
├── client/
│   ├── index.html
│   └── src/
│       ├── core/           # apiFetch, createApiClient, AppContext, pluginRegistry, app/
│       ├── plugins/        # Frontend plugins
│       └── App.tsx         # Renders AppRoutes
├── server/
│   ├── index.ts            # Express entry (prod serves dist/public)
│   └── core/               # ServiceManager, middleware, migrations
├── plugin-loader.js        # Backend plugin discovery (repo root)
├── plugins/                # Backend plugins (model, routes, index.js)
├── config/services.js      # Legacy/env config (see CORE_SERVICES_ARCHITECTURE)
└── docs/
```

**Key points:** one `package.json`, configs at repo root, backend plugins under `plugins/`, frontend under `client/src/plugins/`.

---

## Development Environment Setup

### Prerequisites

- **Node.js** `>=22.18 <23` (see `package.json` → `engines`)
- **PostgreSQL** (local or Neon for dev)
- **Git**

### Installation

```bash
git clone [repository-url] homebase
cd homebase
npm install
node scripts/setup-database.js   # Main DB only — see Database section below
cp .env.example .env.local
# Edit DATABASE_URL, SESSION_SECRET, TENANT_PROVIDER, etc.
```

### Environment variables (essentials)

```bash
# Main DB (users, sessions, tenants)
DATABASE_URL=postgresql://user:password@localhost:5432/homebase_dev
SESSION_SECRET=your-secret-key-here

# Tenant resolution (dev often local; prod neon)
TENANT_PROVIDER=local   # or neon + NEON_API_KEY

# Optional: CSRF in dev
ENABLE_CSRF=true

# Files / cups images (prod)
# R2_* — see .env.example
```

Runtime services exposed via `ServiceManager`: see **`CORE_SERVICES_ARCHITECTURE.md`** (not a full storage/email/queue matrix).

### Running the application

```bash
# Both API + UI
npm run dev:all

# Or separate terminals (from repo root)
npm run dev:api   # http://localhost:3002
npm run dev:ui    # http://localhost:3001
```

```bash
curl http://localhost:3002/api/health
curl http://localhost:3002/api/plugins
```

### Quality checks

```bash
npm run check          # tsc
npm run lint           # eslint (flat config: eslint.config.cjs)
npm test               # jest (server/plugins tests)
npm run build          # production UI + API
```

Pre-commit: **lint-staged** runs `eslint --fix --quiet` and Prettier on staged TS/TSX. Pre-push (husky): `tsc` + `jest`.

---

## Cups: import från SvFF-sidor (HTML/PDF)

- **Kod:** `plugins/cups/services/parseCupSource.js` – `parseCupSource({ html, sourceUrl, sourceType })` returnerar normaliserade cup-rader; `detectCupSourceProfile` väljer vilken parser som ska köras (tabell, accordion, år+månad-lista, PDF, m.m.).
- **Östergötland _Sanktionerade cuper_:** profil `svff_yearmonth_list` när värd är `ostergotland.svenskfotboll.se` och sidan innehåller rubriken _Sanktionerade cuper_; **Futsal**-rader importeras inte.
- **Sync / reimport:** `importFromIngest` upsertar per `(ingest_source_id, external_id)`; location-only skiljer behåller manuell plats men uppdaterar `last_seen_at` (`touchImportSeen`). Allowlist och auto-refresh: [`CUPS_AUTO_REFRESH_CRON.md`](CUPS_AUTO_REFRESH_CRON.md). Distrikts-URL:er (~20): checklista [`CUPS_DISTRICT_SOURCE_CATALOG.md`](CUPS_DISTRICT_SOURCE_CATALOG.md).
- **Historik och full profil-lista:** `docs/CHANGELOG.md` (§ **2026-04 – Cups: SvFF-import** och § **2026-08-11 – Cups + Ingest cleanup**).
- **Publik cup-sajt:** katalogen `public-cups/` (statisk frontend + `api/cups.php`); listning bygger på API som bara exponerar **synliga** cuper (`visible`). Se samma changelog-avsnitt.
- **Pageviews (första-part):** `POST /api/pageview.php` + tenant-tabell via `npm run migrate:cups-pageviews`; admin **Statistik** i Cups. ADR: [`ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md`](ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md). Changelog § **2026-08-12 – Cupappen first-party pageviews**.
- **Nya publika SEO-sajter (mall):** kopiera [`templates/public-app/`](../templates/public-app/) → t.ex. `sites/<name>/`. Ops: [`PUBLIC_APP_TEMPLATE.md`](PUBLIC_APP_TEMPLATE.md). Prod-referens: `public-cups/` (Cupappen).

---

## Plugin development

Följ canonical checklistor — duplicera inte steg här.

| Steg                         | Dokument / plats                                                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend + frontend mallar    | [`templates/README.md`](../templates/README.md)                                                                                                  |
| Publik SEO-sajt (PHP/Caddy)  | [`templates/public-app/`](../templates/public-app/), [`PUBLIC_APP_TEMPLATE.md`](PUBLIC_APP_TEMPLATE.md)                                          |
| Integration (obligatorisk)   | [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](NEW_PLUGIN_INTEGRATION_CHECKLIST.md)                                                                     |
| Design & panel-konventioner  | [`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`](PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md), [`PLUGIN_RUNTIME_CONVENTIONS.md`](PLUGIN_RUNTIME_CONVENTIONS.md) |
| Kodstandard                  | [`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`](PLUGIN_DEVELOPMENT_STANDARDS_V2.md)                                                                       |
| Arkitektur (Action Registry) | [`PLUGIN_ARCHITECTURE_V3.md`](PLUGIN_ARCHITECTURE_V3.md)                                                                                         |
| UI-listor                    | [`UI_AND_UX_STANDARDS_V3.md`](UI_AND_UX_STANDARDS_V3.md) §0                                                                                      |

**Backend SDK:** plugins importerar endast från `@homebase/core` (`Database.get(req)`, `Logger.get()`). Se [`packages/core/README.md`](../packages/core/README.md).

**Aktivera plugin för användare:**

```bash
npm run set:tenant-plugins -- --email=user@example.com --enable=my-plugin
```

---

## Database: main DB vs tenant DB

| Databas                        | Innehåll                                                                   | Hur tabeller skapas                                                                     |
| ------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Main** (`DATABASE_URL`)      | `users`, `sessions`, `tenants`, `tenant_plugin_access`, `user_settings`, … | `node scripts/setup-database.js`                                                        |
| **Tenant** (per tenant / Neon) | `contacts`, `notes`, `tasks`, plugin-data, …                               | SQL i [`server/migrations/`](../server/migrations/README.md) + `npm run migrate:<name>` |

**Vanligt misstag:** lägga plugin-tabeller i `setup-database.js` — det skapar dem i main DB, inte tenant DB.

**Prod parity:** [`LOCAL_PROD_PARITY.md`](LOCAL_PROD_PARITY.md)

---

## Testing

- **Kör:** `npm test` (Jest, främst `.js` under `server/` och `plugins/`).
- **TS API-klienter** (`createApiClient`) har begränsad enhetstest-täckning — se [`CLEANUP_DEFERRED_RISKS.md`](CLEANUP_DEFERRED_RISKS.md) §4.
- **Integration:** starta `npm run dev:api` och testa endpoints via HTTP; det finns ingen `npm run test:integration` i `package.json`.

---

## Deployment

Se canonical guider — duplicera inte Railway/Neon-steg här.

- [`DEPLOYMENT_V2.md`](DEPLOYMENT_V2.md)
- [`RAILWAY_HOMEBASE_SETUP.md`](RAILWAY_HOMEBASE_SETUP.md) (CSRF, rate limit, konsol)
- [`FRONTEND_BUNDLE_ANALYSIS.md`](FRONTEND_BUNDLE_ANALYSIS.md) (`npm run build:ui:analyze`)

---

## Vanliga fallgropar (utveckling)

### `npm run dev` startar bara backend

```bash
npm run dev:all   # API + UI
# eller separat:
npm run dev:api   # :3002
npm run dev:ui    # :3001
```

### `@homebase/core` måste finnas i dependencies

```json
"dependencies": {
  "@homebase/core": "file:packages/core"
}
```

Kör `npm install` efter ändring.

### Git commit kräver gröna hooks

```bash
npm run lint        # eller npm run lint -- --fix
npm run check
npm test
git commit ...
```

`lint-staged` kör ESLint på staged filer; **errors** stoppar commit (`no-explicit-any` är warn).

### Main DB-tabeller vs tenant-tabeller

- Nya **main**-tabeller → `scripts/setup-database.js` + kör scriptet.
- Nya **plugin/tenant**-tabeller → `server/migrations/*.sql` + relevant `npm run migrate:*`.

---

## Troubleshooting

| Problem               | Kontroll                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Frontend laddar inte  | Båda servrar körs? `http://localhost:3001`                                                  |
| Backend-fel           | PostgreSQL uppe? `DATABASE_URL` i `.env.local`?                                             |
| Plugin syns inte      | Registrerad i `pluginRegistry.ts` + `routeMap.ts`? Plugin enabled via `set:tenant-plugins`? |
| CSRF-fel              | `apiFetch` för muterande anrop; se [`SECURITY_GUIDELINES.md`](SECURITY_GUIDELINES.md)       |
| Rate limit 429 i prod | Se [`RAILWAY_HOMEBASE_SETUP.md`](RAILWAY_HOMEBASE_SETUP.md) §6–7                            |

---

## See also

- [`CORE_SERVICES_ARCHITECTURE.md`](CORE_SERVICES_ARCHITECTURE.md) — ServiceManager scope
- [`CORE_ARCHITECTURE_V2.md`](CORE_ARCHITECTURE_V2.md) — client/server-översikt
- [`SECURITY_GUIDELINES.md`](SECURITY_GUIDELINES.md)
- [`TENANT_USERS_AND_RBAC.md`](TENANT_USERS_AND_RBAC.md)
- [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) — agent-regler och anti-patterns
- [`CHANGELOG.md`](CHANGELOG.md)
