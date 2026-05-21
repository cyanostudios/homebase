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

| Variabel       | Anteckning                         |
| -------------- | ---------------------------------- |
| `APP_URL`      | `https://<service>.up.railway.app` |
| `FRONTEND_URL` | Samma som `APP_URL` om monolith    |

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

Förväntat: HTTP 200, `"status":"healthy"`.

Loggar vid start: `BACKEND_VERSION=…`, `File uploads: Cloudflare R2` (om R2 satt).

### Build failar på `husky: not found`

1. Root Directory ska vara **repots rot** (inte `public-cups`).
2. `nixpacks.toml` ska ha `NIXPACKS_SPA_CADDY=false` (undvik Caddy/Vite SPA-pipeline i monorepo).
3. `prepare` använder `scripts/prepare-husky.js` — hoppar över i CI/Railway.

### Build failar på `EBUSY` / `node_modules/.cache`

Kör **inte** `npm ci` igen i `buildCommand` — Nixpacks install-fasen har redan kört `npm ci`. Använd bara `npm run build` i `railway.toml`.

### Svart skärm

1. `NODE_ENV=production` (annars serveras inte admin-UI).
2. Deploy-logg ska visa `Serving UI from .../dist/public`.
3. DevTools → Network: `/assets/*.js` ska vara **200**, inte HTML.
4. Efter CSP/SPA-fix på `main`: trigga **Redeploy** så senaste build körs (kolla `BACKEND_VERSION` i `/api/health` eller deploy-logg).

## 5. Railway Cron (valfritt)

Se [CUPS_AUTO_REFRESH_CRON.md](./CUPS_AUTO_REFRESH_CRON.md):

- `POST https://<homebase-url>/api/cron/cups/refresh`
- Header: `x-cron-secret: <CRON_SECRET>`

Mer bakgrund: [DEPLOYMENT_V2.md](./DEPLOYMENT_V2.md).
