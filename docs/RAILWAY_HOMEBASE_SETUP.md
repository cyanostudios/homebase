# Railway: Homebase (projekt #2)

Steg-för-steg för admin/API på Railway. **Cupappen** (`public-cups/`) är ett **separat** Railway-projekt — rör det inte här.

Repot innehåller [`railway.toml`](../railway.toml) (build, start, healthcheck `/api/health`) och [`nixpacks.toml`](../nixpacks.toml) (Node 22, `NIXPACKS_SPA_CADDY=false`, husky av i CI).

## 1. Ny tjänst i Railway

| Inställning    | Värde                                                               |
| -------------- | ------------------------------------------------------------------- |
| Root directory | `/` (repots rot)                                                    |
| Branch         | `main` (eller release-branch du deployar från)                      |
| Build          | Nixpacks `npm ci` (install) + `railway.toml` → `npm run build` only |
| Start          | `npm start`                                                         |
| Healthcheck    | `/api/health`                                                       |

**Lägg inte till** Railway Postgres på detta projekt — använd Neon main via `DATABASE_URL`.

## 2. Variabler (Railway → Variables)

Kopiera från lokal `.env.local` / Neon Console.

### Obligatoriskt

| Variabel          | Anteckning                               |
| ----------------- | ---------------------------------------- |
| `NODE_ENV`        | `production`                             |
| `DATABASE_URL`    | Neon **main** (users, sessions, tenants) |
| `SESSION_SECRET`  | `openssl rand -base64 32`                |
| `TENANT_PROVIDER` | `neon`                                   |
| `NEON_API_KEY`    | Neon API-nyckel                          |

### Efter första deploy (samma Railway-URL)

| Variabel       | Anteckning                                                             |
| -------------- | ---------------------------------------------------------------------- |
| `APP_URL`      | `https://<service>.up.railway.app` (din faktiska URL)                  |
| `FRONTEND_URL` | **Samma URL som `APP_URL`** när API + SPA körs på en tjänst (monolith) |

Exempel (ersätt med din URL):

```text
APP_URL=https://sweet-courtesy-production-fa4e.up.railway.app
FRONTEND_URL=https://sweet-courtesy-production-fa4e.up.railway.app
```

`DATABASE_URL` från Neon ska inkludera SSL, t.ex. `?sslmode=require` i slutet av connection string.

### System-e-post (lösenordsåterställning)

Glömt lösenord använder **plattforms-Resend** ([`server/core/services/email/systemEmail.js`](../server/core/services/email/systemEmail.js)), inte Mail-pluginets databasinställningar. Kopiera **samma** värden som i **Mail → Inställningar** (Resend):

| Variabel         | Anteckning                                                                        |
| ---------------- | --------------------------------------------------------------------------------- |
| `RESEND_API_KEY` | `re_...` från Resend Dashboard eller Mail-inställningar                           |
| `RESEND_FROM`    | Verifierad avsändare (samma som `resendFromAddress` i Mail)                       |
| `FRONTEND_URL`   | Måste vara din Railway-URL — reset-länken blir `https://…/reset-password/{token}` |

Utan dessa i prod (`NODE_ENV=production`) får användare `EMAIL_NOT_CONFIGURED` vid glömt lösenord. Lokalt i dev visas länken på skärmen istället.

Exportera från Mail-pluginet (samma DB som `DATABASE_URL` / Neon main):

```bash
npm run export:system-email-from-mail -- --write-railway-file
# → .env.railway.resend (gitignored) — klistra in i Railway Variables, redeploy
# eller med Railway CLI inloggad:
./scripts/railway-apply-resend-vars.sh
```

**Resend-avsändare:** `onboarding@resend.dev` fungerar för test (samma som ofta i Mail-pluginet). För egen domän, verifiera domänen i [Resend Dashboard](https://resend.com/domains) och sätt `RESEND_FROM` till t.ex. `noreply@dinverifieradedomän.se`.

Verifiera efter deploy:

```bash
curl -sS https://<din-url>/api/health | jq '.systemEmail, .passwordReset'
# systemEmail.configured ska vara true
```

```bash
curl -sS -X POST 'https://<din-url>/api/auth/forgot-password' \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@homebase.se"}'
# HTTP 200, inte 503 EMAIL_NOT_CONFIGURED
```

Engångstabell (om du vill köra manuellt): `npm run migrate:password-reset` med Neon main `DATABASE_URL`. Efter commit `d6b2d4d` skapas tabellen även automatiskt vid första forgot-anrop.

### Rekommenderat

| Variabel                                                                                       | Anteckning                                                                |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `ENABLE_CSRF`                                                                                  | `true` i prod — kräver session-CSRF (se §5); klienten använder `apiFetch` |
| `RATE_LIMIT_MAX`                                                                               | Valfritt; standard **3000** anrop / 15 min per IP i prod (se §6)          |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cup-hjältebilder                                                          |
| `CRON_SECRET`                                                                                  | För Railway Cron (valfritt)                                               |

### Valfritt

- `PUBLIC_CUPS_URL`, `PUBLIC_CUPS_USER_ID` / `PUBLIC_CUPS_USER_EMAIL` — endast Node `/api/public/cups` och CORS

## 3. Migreringar (engång)

Lokalt med **Neon main** `DATABASE_URL` (samma som Railway):

```bash
# Checklist only (uses .env.local):
npm run railway:preflight

# Against Neon main (paste URL in shell or export from Neon Console):
DATABASE_URL='postgresql://...@....neon.tech/...' npm run railway:migrate
```

Or manually:

```bash
node scripts/setup-database.js
npm run migrate:public-share-routing
```

**Note:** If `.env.local` still points at `localhost`, migrations only touch local Docker — set Neon main URL before `railway:migrate`.

## 4. Verifiering

```bash
curl -sS https://<din-url>/api/health
```

Förväntat: HTTP 200, `"status":"healthy"`, `"authSchema":{"authReady":true,...}`, och `"neonApi":{"status":"ok","projectCount":...}`.

Om `authSchema.authReady` är `false` eller HTTP **503**: tabellerna `users` / `sessions` / `tenants` saknas eller är otillgängliga på Neon main — kör `railway:migrate` (se §3) mot **samma** `DATABASE_URL` som Railway.

Om `neonApi.status` är `missing_key`, `unauthorized` eller `error`: `NEON_API_KEY` på Railway är fel/saknas (signup skapar tenant-projekt via Neon API).

**Verifiera lokalt eller via Railway CLI:**

```bash
npm run verify:neon
# med Neon main URL i shell:
DATABASE_URL='postgresql://...@....neon.tech/neondb?sslmode=require' npm run verify:neon
railway run npm run verify:neon
```

### Flytta lokalt konto till produktion (samma Neon-tenant)

Om användaren skapades mot **lokal** `DATABASE_URL` men tenant-DB ligger i Neon (`green-pine-…` m.m.):

```bash
SOURCE_DATABASE_URL='postgresql://localhost:5432/homebase_dev' \
TARGET_DATABASE_URL='postgresql://...@....neon.tech/neondb?sslmode=require' \
npm run copy:user-to-main -- --email=user@homebase.se
```

Samma e-post/lösenord fungerar sedan på Railway. `TARGET` ska vara samma Neon **main** som Railway `DATABASE_URL`.

Skriptet kör automatiskt **remap** av `user_id` i tenant-DB (lokalt id 7 → produktion id 2) så data syns. Om du kopierat manuellt tidigare:

```bash
MAIN_DATABASE_URL='<Railway Neon main>' \
  node scripts/remap-tenant-user-id.js --from=7 --to=2 --email=user@homebase.se
```

Loggar vid start: `BACKEND_VERSION=…`, `File uploads: Cloudflare R2` (om R2 satt).

### Build failar på `husky: not found`

1. Root Directory ska vara **repots rot** (inte `public-cups`).
2. `nixpacks.toml` ska ha `NIXPACKS_SPA_CADDY=false` (undvik Caddy/Vite SPA-pipeline i monorepo).
3. `prepare` använder `scripts/prepare-husky.js` — hoppar över i CI/Railway.

### Build failar på `EBUSY` / `node_modules/.cache`

Kör **inte** `npm ci` igen i `buildCommand` — Nixpacks install-fasen har redan kört `npm ci`. Använd bara `npm run build` i `railway.toml`.

### Build failar på `vite: not found`

Install-fasen måste inkludera devDependencies: `nixpacks.toml` → `[phases.install]` med `npm ci --include=dev` (vite, typescript, tsc). `NODE_ENV=production` på Railway räcker inte med bara `NPM_CONFIG_PRODUCTION=false`.

### Svart skärm

1. `NODE_ENV=production` (annars serveras inte admin-UI).
2. Deploy-logg ska visa `Serving UI from .../dist/public`.
3. DevTools → Network: `/assets/*.js` ska vara **200**, inte HTML.
4. Efter CSP/SPA-fix på `main`: trigga **Redeploy** så senaste build körs (kolla `BACKEND_VERSION` i `/api/health` eller deploy-logg).
5. Console **`X is not a function` i `plugin-files.*.js`** (ofta Radix): `vite.config.ts` ska ha `vendor-radix` / `vendor-lucide` — inte dela `@radix-ui` via en annan plugin-chunk. Det är **inte** `DATABASE_URL` / Railway Variables.

**Variabler som påverkar UI:** `NODE_ENV=production`, `APP_URL` / `FRONTEND_URL` (CORS/redirect efter login). Saknad `vite.svg` (404 favicon) ger **inte** svart skärm.

### Login: `GET /api/auth/me` 401 och `POST /api/auth/login` 500

| Symptom                                                    | Betydelse                                                                                                 |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/auth/me` → **401**                               | Normalt **innan** inloggning (ingen session).                                                             |
| `POST /api/auth/login` → **401**                           | Fel e-post/lösenord, eller användaren finns inte i **Neon main** `users`.                                 |
| `POST /api/auth/login` → **503** + `TENANT_NOT_CONFIGURED` | Användaren finns men saknar `tenants.neon_connection_string` / membership.                                |
| `POST /api/auth/login` → **500**                           | Serverkrasch — kolla **Railway → Deployments → View logs** efter login-försök. Vanliga orsaker nedan.     |
| `POST /api/auth/login` → **503** + `SCHEMA_MISSING`        | Main DB saknar auth-tabeller (efter senaste deploy). Kör `railway:migrate`.                               |
| Fel lösenord men fortfarande **500** (inte 401)            | Ofta `users`-tabellen saknas — SQL kastar innan lösenordskontroll. Migrera + `/api/health` → `authReady`. |

**Checklista (Railway Variables):**

1. `DATABASE_URL` = Neon **main** (samma som du migrerat), med `sslmode=require` om Neon kräver det.
2. `SESSION_SECRET` = stark nyckel (`openssl rand -base64 32`), inte dev-default.
3. `TENANT_PROVIDER` = `neon`
4. `NEON_API_KEY` = satt (för tenant-uppslag; inte samma som connection string).
5. `NODE_ENV` = `production`
6. `APP_URL` + `FRONTEND_URL` = din Railway-URL (monolith).

**Engång — migrera Neon main** (om du inte gjort det mot samma URL som Railway använder):

```bash
DATABASE_URL='postgresql://...@....neon.tech/neondb?sslmode=require' npm run railway:migrate
```

Det skapar bl.a. `users`, `sessions`, `tenants`, `user_plugin_access`.

**Verifiera användare i Neon:** Kontot du loggar in med måste finnas i **main**-databasens `users` (samma e-post som lokalt om du kopierat data). Rad i `tenants` med `neon_connection_string` för den användaren (eller aktiv `tenant_memberships`).

**Snabbtest från terminal:**

```bash
curl -sS -X POST 'https://<din-railway-url>/api/auth/login' \
  -H 'Content-Type: application/json' \
  -d '{"email":"din@email.se","password":"ditt-lösenord"}'
```

- **200** + `user` → login OK; om UI fortfarande strular, hård refresh / cookies.
- **401** → fel credentials eller saknad user i Neon main.
- **503** + `TENANT_NOT_CONFIGURED` → tenant-rad saknas i main DB.
- **500** → läs felrad i Railway-loggen (`Login failed`, `relation "users" does not exist`, session, SSL, m.m.).

## 5. CSRF i produktion (`ENABLE_CSRF=true`)

Homebase använder **`csurf`** med hemlighet lagrad i **express-session** (`csrf({ cookie: false })`), inte en separat CSRF-cookie.

| Komponent      | Plats                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Middleware     | `server/core/middleware/csrf.js`                                                                  |
| Token-endpoint | `GET /api/csrf-token` (registrerad i `server/index.ts` **före** global rate limiter)              |
| Klient         | `client/src/core/api/apiFetch.ts` — hämtar token, skickar `X-CSRF-Token` på POST/PUT/PATCH/DELETE |
| Plugin-rutter  | t.ex. `plugins/cups/routes.js` — `csrfProtection` på muterande metoder                            |

### Varför inte `cookie: true`?

`csurf` i **cookie-läge** kräver att `req.cookies` finns (via **`cookie-parser`**). Homebase har bara `express-session` + `connect-pg-simple`. Utan `cookie-parser` kastar middleware **`misconfigured csrf`** → **500** på `/api/csrf-token` och alla muterande API-anrop.

**Fix (2026-06, commit `0bb24b9`):** session-lagrad `csrfSecret` på `req.session`.

### Verifiera efter deploy

```bash
curl -sS https://<din-url>/api/csrf-token
```

| Svar                                            | Betydelse                                                   |
| ----------------------------------------------- | ----------------------------------------------------------- |
| **200** `{"csrfToken":"..."}`                   | OK — CSRF aktiv                                             |
| **200** `{"csrfToken":"csrf-disabled"}`         | `ENABLE_CSRF` är inte `true` på servern                     |
| **500** `INTERNAL_ERROR` / `CSRF_MISCONFIGURED` | Gammal build eller fel CSRF-konfig — deploya senaste `main` |

Login-flödet anropar token-endpointen två gånger vid retry i `apiFetch`; det är förväntat.

### Deploy-branch

Railway ska deploya från **`main`** (eller en branch som innehåller minst `0bb24b9` + `74d23d7`). Fixen låg tidigare bara på `homebase-v3.6` medan prod körde äldre `main` → prod fortsatte ge 500 tills `main` mergades.

Mer bakgrund: [`SECURITY_GUIDELINES.md`](SECURITY_GUIDELINES.md) (CSRF), [`LESSONS_LEARNED.md`](LESSONS_LEARNED.md) (misconfigured csrf).

## 6. Rate limiting i produktion

Global limiter: `server/core/middleware/rateLimit.js`, mountad som `app.use('/api', globalLimiter)` i `server/index.ts`.

| Miljö                 | Beteende                                                              |
| --------------------- | --------------------------------------------------------------------- |
| `NODE_ENV=production` | Limit **aktiv** (såvida inte `FORCE_RATE_LIMIT` används i dev)        |
| Utveckling            | Limit **av** som standard (SPA + HMR + många parallella plugin-fetch) |
| `FORCE_RATE_LIMIT=1`  | Tvinga limit lokalt/staging för att testa 429                         |

### Gränser (efter 2026-06)

| Limiter           | Prod                                | Dev                   |
| ----------------- | ----------------------------------- | --------------------- |
| Global `/api/*`   | **3000** / 15 min per IP (standard) | 5000 (om limit är på) |
| Auth login/signup | 5 / min per IP                      | 200 / min             |

Överstyr prod-tak med `RATE_LIMIT_MAX` (positivt heltal).

### Undantag från global limiter

Dessa paths skippas (både med och utan `/api`-prefix, eftersom mount strip:ar prefix):

- `/health`, `/csrf-token`
- `/auth/me`, `/auth/login`, `/auth/signup`

### Symptom: massor av **429** i konsolen

Tidigare prod-tak var **100 / 15 min**. Efter misslyckad login försöker dashboarden ladda **alla** plugins parallellt (settings, cups, ingest, files, slots, contacts, notes, …) → gränsen nådd → kedja av 429 och “Network error” i UI.

**Åtgärd:** deploya `74d23d7` eller senare; vid behov sätt `RATE_LIMIT_MAX=5000` i Railway Variables.

## 7. Felsökning i webbläsarkonsolen

| Konsol / nätverk                                     | Status  | Förklaring                                                                |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------------------- |
| `GET /api/auth/me`                                   | **401** | Normalt **innan** inloggning — ingen sessioncookie.                       |
| `favicon.ico`                                        | **404** | Ofarligt — ingen favicon i `dist/public`.                                 |
| i18next / Locize-rad                                 | Info    | Reklam från i18next, inte ett appfel.                                     |
| `GET /api/csrf-token`                                | **500** | CSRF felkonfigurerad eller gammal deploy — se §5.                         |
| `GET /api/csrf-token` (×2 vid login)                 | **500** | Samma; `apiFetch` retry.                                                  |
| `GET /api/settings/*`, `/api/cups`, `/api/ingest`, … | **429** | Rate limit — ofta **efter** trasig CSRF + många parallella anrop — se §6. |
| “Failed to fetch settings: Network error”            | Följd   | Klienten tolkar 429/500 som nätverksfel.                                  |

**Efter lyckad deploy:** hård refresh eller inkognito → logga in → `/api/csrf-token` ska vara 200, plugin-GET ska inte spam:a 429.

### Data synlig efter login men “tom” tenant

Om användare kopierats från lokal DB till Neon main med **annat `user_id`** (t.ex. lokalt 7, prod 2) måste tenant-rader remap:as:

```bash
MAIN_DATABASE_URL='<Neon main>' \
  node scripts/remap-tenant-user-id.js --from=7 --to=2 --email=user@homebase.se
```

Eller kör `npm run copy:user-to-main` (gör remap automatiskt). Se §4 ovan.

## 8. Railway Cron (valfritt)

Se [CUPS_AUTO_REFRESH_CRON.md](./CUPS_AUTO_REFRESH_CRON.md):

- `POST https://<homebase-url>/api/cron/cups/refresh`
- Header: `x-cron-secret: <CRON_SECRET>`

Mer bakgrund: [DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md).
