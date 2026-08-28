# Homebase

Modulär plugin-baserad affärsplattform. Full dokumentation: **[docs/README.md](./docs/README.md)**.

[![Docs](https://img.shields.io/badge/Docs-docs%2FREADME-blue)](./docs/README.md)

---

## Kritisk policy för utvecklare och AI-agenter

**Ändra inte kod som redan fungerar och är godkänd utan explicit instruktion.**

- Vid osäkerhet → fråga först
- Vid misstänkt fel → rapportera, ändra inte på eget initiativ
- Undantag: explicit uppdrag, dokumenterad buggfix, eller godkänd ticket

Se [docs/LESSONS_LEARNED.md](./docs/LESSONS_LEARNED.md) för anti-patterns och rätt arbetssätt.

---

## Snabbstart

```bash
git clone [repository-url] homebase
cd homebase
npm install
node scripts/setup-database.js   # Main DB (users, sessions, tenants)
cp .env.example .env.local       # DATABASE_URL, SESSION_SECRET, TENANT_PROVIDER, …
npm run dev:all                  # API :3002 + UI :3001
```

**Ny plugin:** kopiera mallar från [`templates/`](./templates/README.md) och följ [`docs/NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](./docs/NEW_PLUGIN_INTEGRATION_CHECKLIST.md). Tenant-tabeller via SQL i [`server/migrations/`](./server/migrations/README.md) — inte `setup-database.js`.

**Local ↔ prod parity:** [`docs/LOCAL_PROD_PARITY.md`](./docs/LOCAL_PROD_PARITY.md)

---

## Dokumentation (canonical)

| Ämne               | Dokument                                                                             |
| ------------------ | ------------------------------------------------------------------------------------ |
| Index              | [docs/README.md](./docs/README.md)                                                   |
| Utveckling & setup | [docs/DEVELOPMENT_GUIDE_V2.md](./docs/DEVELOPMENT_GUIDE_V2.md)                       |
| Plugin-standarder  | [docs/PLUGIN_DEVELOPMENT_STANDARDS_V2.md](./docs/PLUGIN_DEVELOPMENT_STANDARDS_V2.md) |
| Arkitektur         | [docs/PLUGIN_ARCHITECTURE_V3.md](./docs/PLUGIN_ARCHITECTURE_V3.md)                   |
| UI/UX              | [docs/UI_AND_UX_STANDARDS_V3.md](./docs/UI_AND_UX_STANDARDS_V3.md)                   |
| Säkerhet           | [docs/SECURITY_GUIDELINES.md](./docs/SECURITY_GUIDELINES.md)                         |
| Tenant / RBAC      | [docs/TENANT_USERS_AND_RBAC.md](./docs/TENANT_USERS_AND_RBAC.md)                     |
| AI-utvecklingsteam | [docs/ai/](./docs/ai/)                                                               |
| Changelog          | [docs/CHANGELOG.md](./docs/CHANGELOG.md)                                             |

---

## Kommandon

```bash
npm run dev:all          # Backend + frontend
npm run dev:api          # Backend only (port 3002)
npm run dev:ui           # Frontend only (port 3001)
npm run check            # TypeScript
npm run lint             # ESLint
npm test                 # Jest (server/plugins)
npm run build            # Production build
```

---

## Branch & deploy

- **`homebase-v4.0`** — aktiv utvecklingsbranch
- **`main`** — produktion (Railway)
- **Node:** `>=22.18 <23`

---

**Senast uppdaterad:** 2026-07-07
