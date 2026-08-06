# Public app template (PHP + Caddy)

Copy-and-rename scaffold for **Cupappen-class** public sites: SEO/SSR detail pages, own Railway service, data from a Homebase admin plugin’s **tenant** Neon DB.

Reference implementation in production: [`public-cups/`](../../public-cups/) (Cupappen).

Full ops checklist: [`docs/PUBLIC_APP_TEMPLATE.md`](../../docs/PUBLIC_APP_TEMPLATE.md).  
Design system (AppShell, tokens, components): [`docs/PUBLIC_APP_DESIGN.md`](../../docs/PUBLIC_APP_DESIGN.md).

**Shell chrome:** `.app-atmosphere` bakom UI; frosted `.top-bar`; `.hero-band` (hero + valfri `#shared-filter` + quick-nav). Path-listing (`/`, `/alla/`, `/info/`, `/kategori/…`) via `lib/listingUrls.js`. Hem|Alla|Info (inga Favoriter default). Kategori = `.item-grid`; hem = `.item-row`. Detalj med steps: `.step-subheader` + Klart → kategori. Audio opt-in. Brand via `:root` tokens — kopiera inte Cupappen- eller instructions-färger.

## Quick start

```bash
# From repo root
cp -R templates/public-app sites/myapp
# or: public-myapp/
```

Then:

1. Rename env prefix `APP_` → your prefix (e.g. `MYAPP_`) in PHP files and `railway.env.example`.
2. Wire SQL in `api/db_helpers.php` to your real table(s) (template uses placeholder `items`).
3. Update detail route in `docker/Caddyfile` and `router.php` if not `/item/…`.
4. Replace copy in `index.html`, `item.php`, `robots.txt`, `llms.txt`, `styles.css`.
5. Create optional Homebase public plugin `plugins/public-myapp/` (see below).
6. New Railway service: **Root Directory** = `sites/myapp`, Dockerfile builder.
7. Set `APP_DB_URL` = **tenant** Postgres (never Homebase main `DATABASE_URL`).
8. Verify: `curl https://www.myapp.se/api/health.php` → `{"status":"ok"}`.

### Local PHP serve

```bash
# Example npm script (add to package.json):
# "dev:myapp": "sh -c 'set -a; [ -f .env.local ] && . ./.env.local; set +a; php -S 0.0.0.0:3010 -t sites/myapp sites/myapp/router.php'"

php -S 0.0.0.0:3010 -t sites/myapp sites/myapp/router.php
```

Export `APP_DB_URL` (or `DATABASE_URL` for local fallback) before starting PHP.

Local listing JS defaults to Homebase Node `http://localhost:3002/api/public/appname` — override with `window.PUBLIC_APP_API_URL` or point at `/api/items.php` once PHP has DB.

## Layout

| Path                                   | Role                                 |
| -------------------------------------- | ------------------------------------ |
| `index.html` + `app.js` + `styles.css` | Listing shell + path routing         |
| `lib/listingUrls.js`                   | Pure helpers for listing paths       |
| `item.php`                             | SSR detail (title, OG, JSON-LD, 404) |
| `api/items.php`                        | Whitelisted JSON list                |
| `api/item_detail.php`                  | Optional JSON by slug                |
| `api/sitemap.php`                      | Dynamic `/sitemap.xml`               |
| `api/health.php`                       | Railway / Docker HEALTHCHECK         |
| `Dockerfile` + `docker/`               | PHP-FPM + Caddy + Supervisor         |
| `railway.toml`                         | Separate Railway service             |

## Env contract (this service)

| Variable              | Required    | Notes                                   |
| --------------------- | ----------- | --------------------------------------- |
| `APP_DB_URL`          | Yes (prod)  | Tenant Neon connection string           |
| `APP_PUBLIC_URL`      | Recommended | Canonical `https://www…` for sitemap/OG |
| `APP_ALLOWED_ORIGINS` | Optional    | CORS allowlist                          |
| `APP_CACHE_TTL`       | Optional    | Seconds; APCu if available              |
| `APP_DEBUG_ERRORS`    | Debug only  | `1` adds `details` in JSON errors       |

## Homebase side (admin + optional public Node API)

| Piece                     | Location                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Admin CRUD                | `plugins/<name>/` + `client/src/plugins/<name>/`                                     |
| Optional local public API | `plugins/public-<name>/` — copy [`plugins/public-cups/`](../../plugins/public-cups/) |
| CORS / tenant owner       | `PUBLIC_<NAME>_URL`, `PUBLIC_<NAME>_USER_ID` in `.env` / Railway Homebase            |

`plugins/public-*` pattern (4 files):

- `plugin.config.js` — `routeBase: '/api/public/<name>'`
- `index.js` — tenant pool via `PUBLIC_<NAME>_USER_ID`, mount GET `/`
- `model.js` — whitelist SELECT (same fields as PHP)
- `controller.js` — `{ items: [...] }` JSON

Wire CORS in [`server/index.ts`](../../server/index.ts) and shutdown pool like cups/guides.

## Do not

- Point `APP_DB_URL` at Homebase **main** Neon (`users` / `tenants`).
- Deploy this folder with Homebase’s root `railway.toml`.
- Drop `postgresql-libs` from the Dockerfile after `pdo_pgsql` install.
