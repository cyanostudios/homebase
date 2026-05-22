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

### Rekommenderat

| Variabel                                                                                       | Anteckning                  |
| ---------------------------------------------------------------------------------------------- | --------------------------- |
| `ENABLE_CSRF`                                                                                  | `true`                      |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Cup-hjältebilder            |
| `CRON_SECRET`                                                                                  | För Railway Cron (valfritt) |

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

## 5. Railway Cron (valfritt)

Se [CUPS_AUTO_REFRESH_CRON.md](./CUPS_AUTO_REFRESH_CRON.md):

- `POST https://<homebase-url>/api/cron/cups/refresh`
- Header: `x-cron-secret: <CRON_SECRET>`

Mer bakgrund: [DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md).
