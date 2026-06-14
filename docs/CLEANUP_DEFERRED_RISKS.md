# Cleanup — utelämnat och risker (maj 2026)

Detta dokument fångar det som **medvetet lämnades utanför** eller bara **delvis** åtgärdades i femkategoriers-städningen (`homebase-v3.6` → `main`, commits `c5049b3`–`28293bf`). Använd det som backlog inför **nästa cleanup-runda**.

Risknivåer: **Hög** = säkerhet/data/prod synligt, **Medel** = teknisk skuld/regression över tid, **Låg** = kosmetik/konsistens.

---

## 1. Uttryckligen out of scope (planen — rör ej utan separat beslut)

| Område                             | Var                                                   | Risk                             | Varför utelämnat                                                                                                 |
| ---------------------------------- | ----------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **csurf → modern CSRF**            | `server/core/middleware/csrf.js`, `ENABLE_CSRF`       | **Hög** (säkerhet)               | Deprecated `csurf`; migration till t.ex. `csrf-csrf` kräver koordinerad klient/server-test och prod-flagga.      |
| **Legacy tenant-uppslag**          | `server/core/services/tenant/TenantContextService.js` | **Medel–Hög**                    | Flera vägar (legacy `tenants.user_id`, `tenant_memberships`, owner-fallback). Fel här → fel tenant/inga plugins. |
| **Plugin-loader pool-passthrough** | `plugin-loader.js` (laddas från `server/index.ts`)    | **Medel**                        | Koppling mellan gammal loader och V2 pool; risk vid refaktor av bootstrap.                                       |
| **AuthService backward-compat**    | `server/core/services/auth/AuthService.js`            | **Medel**                        | `user_id` + `owner_user_id`, `user_plugin_access` parallellt med tenant-plugin-access.                           |
| **Cupappen / `public-cups/`**      | Separat repo-path + eget Railway-projekt              | **Hög** (om man rör fel projekt) | Medvetet isolerat från Homebase-deploy och cleanup.                                                              |

**Rekommendation nästa gång:** egen mini-plan per rad med testmatris (login, tenant-byte, CSRF på/off, prod Railway).

---

## 2. Stora refaktorer — skjutna till framtida PR

| Fil / område                                             | Storlek (ca)           | Risk om den växer | Notering                                                                                |
| -------------------------------------------------------- | ---------------------- | ----------------- | --------------------------------------------------------------------------------------- |
| `plugins/cups/services/parseCupSource.js`                | ~2722 rader            | **Medel**         | SvFF-import, svår att testa; bör delas i parser / normalizer / persist.                 |
| `client/src/plugins/contacts/components/ContactList.tsx` | ~1094                  | **Medel**         | List+filter+export i en komponent.                                                      |
| `client/src/plugins/contacts/components/ContactForm.tsx` | ~1074                  | **Medel**         | Form + validering + mentions.                                                           |
| `client/src/plugins/slots/components/SlotView.tsx`       | ~1032                  | **Medel**         | Delvis `dateFormat` men fortfarande monolit.                                            |
| **Slots/Matches list-logik**                             | Flera list-komponenter | **Låg–Medel**     | Duplicerad sortering/filter/export-mönster.                                             |
| **TeamView / TeamForm / MatchView**                      | ~800+ rader vardera    | **Medel**         | Jun 2026 cleanup minskade död kod och memoized providers; filerna är fortfarande stora. |

**Jun 2026 (matches/teams cleanup):** Borttagna panel-`*SettingsForm`, oanvända context-metoder, memoized `MatchProvider`/`TeamProvider` context values, delade `formatMatchDateTime` / `MatchStatusBadges`.

---

## 3. Delvis gjort i kategori 5 (kvarvarande skuld)

### 3.1 `createApiClient` — inte alla API:er

Migrerade (13+): contacts, notes, slots, matches, tasks, estimates, ingest, mail, pulses, **teams**, **requests**, **schedule**.

**Kvar med egen `request()`** (olika felhantering / basePath / FormData):

| API           | Fil                                               | Risk                                                          |
| ------------- | ------------------------------------------------- | ------------------------------------------------------------- |
| Cups          | `client/src/plugins/cups/api/cupsApi.ts`          | **Medel** — text/JSON-felparse, inte samma som standard-JSON. |
| Files         | `client/src/plugins/files/api/filesApi.ts`        | **Medel** — FormData, DELETE utan body.                       |
| Cloud storage | `client/src/plugins/files/api/cloudStorageApi.ts` | **Medel**                                                     |
| Invoices      | `client/src/plugins/invoices/api/invoicesApi.ts`  | **Medel** — 409/valideringsfel, konstruktor med `basePath`.   |
| Team          | `client/src/core/api/teamApi.ts`                  | **Låg**                                                       |
| Activity log  | `client/src/core/api/activityLogApi.ts`           | **Låg**                                                       |

**Risk:** divergerande felobjekt (`status`, `code`, `details`) och dubbel underhåll vid CSRF/API-ändringar.

**Nästa steg:** utöka `createApiClient` med hooks (`parseError`, `skipJsonContentType`, `emptyBodyAsNull`) eller tunna wrappers per plugin — **inte** en stor bang-refaktor.

### 3.2 `dateFormat` (sv-SE) — bara stegvis migrering

Central util: `client/src/core/utils/dateFormat.ts`.

**Redan migrerat (exempel):** export-config contacts/notes, `DetailActivityLog`, `IngestSourceList` (delvis), `SlotView` (datetime helpers).

**Fortfarande många `toLocaleDateString` / `toLocaleString` direkt i UI** (~40+ filer i `client/src/`). Risk: **Låg** för funktion, **Medel** för UX-konsistens (blandade locale/default).

**Nästa steg:** migrera per plugin (invoices, cups, matches list, tasks list) + PDF/web templates (`estimates/webTemplate.ts`).

---

## 4. Tester och kvalitetssäkring

| Punkt                              | Status                                                        | Risk                                                                                              |
| ---------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **`notes.test.js`**                | Arkiverad under `server/plugins/notes/__tests__/__archive__/` | **Medel** — ingen automatisk täckning för V2 `NoteModel` (`create(req, …)`, `Database.get(req)`). |
| **ProviderSwitching**              | Grön i suite; env `TENANT_PROVIDER`/`POOL_PROVIDER` känslig   | **Låg** vid isolerad körning, **Medel** om testordning/load order ändras.                         |
| **Jest endast `.js`**              | Ingen ts-jest/vitest                                          | **Medel** — TS-API:er (`createApiClient`) testas inte enhetligt.                                  |
| **ESLint `no-explicit-any: warn`** | ~456 varningar (`npm run lint`)                               | **Medel** — teknisk skuld; pre-commit använder `--quiet` (fel stoppar, varningar inte).           |
| **`no-unused-vars: error`**        | Aktiv                                                         | Bra, men kan kräva `_`-prefix vid städning.                                                       |

**Nästa steg:** skriv 1–2 integrationstester för notes med mock `req` + tenant pool, eller flytta model-tester till `plugins/notes/__tests__/` med V2-setup.

---

## 5. Beroenden och borttagna paket (kategori 2)

~130 npm-paket borttagna (passport, zod, recharts, m.fl.) efter `depcheck` + `rg`-verifiering.

| Risk                                                     | Åtgärd nästa gång                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Dynamisk `require` / runtime-import** som grep missade | Röktest alla plugins i UI efter `npm ci`; ev. `depcheck` i CI.                       |
| **`npm audit`** (csurf, axios, jspdf, …)                 | Dokumenterat i `server/core/README.md` — planerad uppgradering, inte körd i cleanup. |

---

## 6. Drift / Railway / produktion (ej del av kod-cleanup)

| Punkt                                  | Risk                                 | Status                                                                                               |
| -------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **CSP / SPA-routing** efter deploy-fix | **Hög** om ej redeployat             | Kräver att `main` (t.ex. `3a41a69+`) är live på Railway.                                             |
| **`APP_URL` / `FRONTEND_URL`**         | **Medel**                            | Måste matcha Railway-URL för länkar/CSRF/cookies.                                                    |
| **`ENABLE_CSRF=true` i prod**          | **Medel** (session-CSRF fix 2026-06) | Kräv `csrf({ cookie: false })`; verifiera `curl /api/csrf-token`. Se `RAILWAY_HOMEBASE_SETUP.md` §5. |
| **`.env.local` → localhost**           | **Medel** (operatör)                 | Neon-prod-migreringar körs manuellt med rätt `DATABASE_URL`.                                         |
| **Husky pre-push**                     | **Låg**                              | Kör `tsc` + `jest`; varning om deprecated husky.sh före v10.                                         |

Se `docs/RAILWAY_HOMEBASE_SETUP.md`.

---

## 7. Övrigt som planen nämnde men inte slutförde

| Punkt                                           | Kommentar                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **`bundle-stats.html` i git**                   | Ska vara borttagen + i `.gitignore` (kategori 1). Genereras lokalt via `npm run build:ui:analyze`. |
| **Dubbel Vite-config**                          | `vite.config.mts` borttagen; endast `vite.config.ts`.                                              |
| **CI med `eslint --max-warnings=0`**            | Inte verifierat i denna repo-runda — om CI läggs till, synka med lint-staged (`--quiet` vs warn).  |
| **`createApiClient` returnerar `Promise<any>`** | Medvetet för migration; nästa steg är generiska helpers eller zod-scheman per endpoint.            |

---

## 8. Föreslagen prioritering (nästa cleanup)

1. **CSRF-migration** (csurf bort) + prod-checklista — **Hög**
2. **TenantContextService** — dokumentera och testa alla upplösningsvägar; ev. feature-flagga bort legacy — **Hög**
3. **Notes V2-tester** (ersätt arkiverad suite) — **Medel**
4. **Resten av `createApiClient` + `dateFormat`** — **Medel**, plugin för plugin
5. **`parseCupSource.js` split** — **Medel**, egen PR
6. **Stora UI-komponenter** (ContactList/Form, SlotView) — **Medel**, UX-regressionstest manuellt
7. **ESLint: minska `any`** (t.ex. mål <100 varningar) — **Låg–Medel**
8. **npm audit** utvalda paket — **Medel**

---

## 9. Relaterade commits (referens)

| Kategori    | Commit    | Kort                                  |
| ----------- | --------- | ------------------------------------- |
| 1 Kosmetisk | `c5049b3` | Vite, headers, PluginNameUnion        |
| 2 Död kod   | `e591b36` | deps, `scripts/archive/`, passthrough |
| 3 TS        | `bcb3696` | 49→0 TS-fel, pre-push                 |
| 4 Tester    | `8978002` | MockAdapter, notes archive            |
| 5 Refaktor  | `28293bf` | createApiClient, dateFormat           |

Uppdatera denna fil när nästa runda startar (datum + vilka rader som stängts).
