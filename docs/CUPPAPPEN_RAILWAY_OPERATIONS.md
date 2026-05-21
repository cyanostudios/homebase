# Cupappen — drift, Railway och vanliga misstag

**Syfte:** Undvika att publika cupappen.se bryts när Homebase ändras, Docker byggs om, eller Railway konfigureras om.

Cupappen är **inte** samma tjänst som Homebase API. Den kör **PHP + Caddy** i `public-cups/` och läser **tenant-Postgres** via `CUPS_DB_URL`.

---

## Två Railway-tjänster (rör aldrig ihop)

|                  | **Homebase**                                              | **Cupappen (public)**                                       |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------------------- |
| **Kod**          | Repots rot (`server/`, `client/`, `plugins/`)             | **`public-cups/`**                                          |
| **Config**       | `railway.toml` (rot)                                      | **`public-cups/railway.toml`**                              |
| **Build**        | `npm ci && npm run build` (Node)                          | **`public-cups/Dockerfile`** (PHP-FPM + Caddy)              |
| **Main DB**      | `DATABASE_URL` = Neon **main** (users, sessions, tenants) | **Använd inte** som cup-lista                               |
| **Cup-data**     | Via tenant pool i admin (`plugins/cups/`)                 | **`CUPS_DB_URL`** = samma **tenant** Neon som cups-tabellen |
| **R2 / uploads** | `R2_*` på Homebase-tjänsten                               | Endast för **bild-URL:er** i DB (sparas från Homebase)      |

**Misstag:** Deploya Homebase på Cupappen-tjänsten, eller sätta Homebase `DATABASE_URL` som `CUPS_DB_URL` → tom lista, fel schema, eller 500.

---

## Checklista vid ny Cupappen-deploy eller “inga cuper”

### 1. Railway-projektinställningar

- [ ] **Root Directory** = `public-cups`
- [ ] Builder = Dockerfile (`public-cups/Dockerfile`)
- [ ] Healthcheck = `/api/health.php`
- [ ] Branch = t.ex. `main`

### 2. Miljövariabler (Cupappen-tjänsten)

| Variabel               | Krav                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `CUPS_DB_URL`          | **Obligatorisk.** Tenant Postgres connection string (från `tenants.neon_connection_string` i main DB). |
| `CUPS_ALLOWED_ORIGINS` | `https://cupappen.se,https://www.cupappen.se`                                                          |
| `CUPS_PUBLIC_SITE_URL` | `https://www.cupappen.se` (rekommenderat)                                                              |
| `CUPS_CACHE_TTL`       | Valfri (t.ex. `60`)                                                                                    |
| `CUPS_DEBUG_ERRORS`    | `1` **endast** vid felsökning — visar `details` i JSON                                                 |

Mall: [`public-cups/railway.env.example`](../public-cups/railway.env.example)

### 3. Verifiera efter deploy (obligatoriskt)

```bash
# 1) Health — ska vara ok
curl -sS https://www.cupappen.se/api/health.php
# {"status":"ok"}

# 2) Cup-lista — ska vara JSON med cups-array
curl -sS https://www.cupappen.se/api/cups.php | head -c 200
# {"cups":[...

# 3) Ska INTE vara HTML
curl -sS -o /dev/null -w "%{content_type}\n" https://www.cupappen.se/api/cups.php
# application/json; charset=utf-8
```

### 4. Startloggar (Container)

**Ska inte finnas:**

```text
Unable to load dynamic library 'pdo_pgsql' ... libpq.so.5: No such file or directory
```

Om den finns → Docker-imagen saknar `postgresql-libs` → **rebuild** med aktuell `public-cups/Dockerfile`.

---

## Docker: `pdo_pgsql` och `libpq` (maj 2026-incident)

### Vad som gick fel

`Dockerfile` installerade `postgresql-dev`, kompilerade `pdo_pgsql`, och **raderade** `postgresql-dev` utan att behålla **runtime-biblioteket** `libpq`.

Effekt i produktion:

- PHP-varning vid start: `Unable to load dynamic library 'pdo_pgsql'`
- `/api/health.php` → `503 {"status":"unhealthy"}`
- `/api/cups.php` → `500 {"error":"Failed to fetch cups"}`
- Webbläsaren: `Failed to load resource: 500` i `app.js` → **inte** “cuper raderade”

### Korrekt mönster (följ alltid)

```dockerfile
apk add --no-cache postgresql-libs    # STANNAR kvar — libpq.so
apk add --virtual .php-build-deps postgresql-dev $PHPIZE_DEPS
docker-php-ext-install pdo_pgsql
apk del .php-build-deps              # Ta bara bort build-deps
```

**Regel:** Ta aldrig bort `postgresql-libs` efter build.

---

## DNS / Cloudflare

| URL                                    | Beteende                                              |
| -------------------------------------- | ----------------------------------------------------- |
| `https://www.cupappen.se/api/cups.php` | **Kanonisk** API (PHP via Caddy)                      |
| `https://cupappen.se/api/cups.php`     | Kan **301** till startsidan → HTML → JS får inte JSON |

`app.js` använder `https://www.cupappen.se` som API-origin när besökaren är på apex `cupappen.se`. Fixa ändå Cloudflare så `/api/*` inte tappar path vid redirect.

---

## Webbläsarfel — vad de betyder

| Symtom i DevTools                                | Betydelse                          | Åtgärd                                                  |
| ------------------------------------------------ | ---------------------------------- | ------------------------------------------------------- |
| `/api/cups.php` **500** + `Failed to fetch cups` | PHP/DB-fel på servern              | Health + `CUPS_DEBUG_ERRORS`, Dockerfile, `CUPS_DB_URL` |
| `/api/cups.php` **200** men HTML                 | Fel routing (SPA istället för PHP) | www + Cloudflare `/api/*`                               |
| **200** `{"cups":[]}`                            | API OK, inga synliga rader         | `visible`, `deleted_at`, import i Homebase              |
| `Failed to load cups: Server returned 500`       | Samma som 500 ovan                 | Server-side, inte klientbugg                            |

Homebase-ändringar (cleanup, TypeScript, `createApiClient`, tester) **deployas inte** till Cupappen automatiskt. Endast ändringar under `public-cups/` + Railway Cupappen-tjänsten påverkar sajten.

---

## SQL och schema (tenant-DB)

Public API (`api/cups.php`) använder [`api/db_helpers.php`](../public-cups/api/db_helpers.php):

- Filtrerar `visible = true`
- Lägger till `deleted_at IS NULL` **om** kolumnen finns (migration `070-cups-sync-state.sql`)
- `LEFT JOIN ingest_sources` **om** kolumn/tabell finns

Kör tenant-migrationer via Homebase om nya kolumner saknas; public API anpassar sig men **kräver** fortfarande en fungerande `cups`-tabell.

---

## Ändringar i Homebase som påverkar cupappen (indirekt)

| Ändring i Homebase                               | Påverkan på cupappen.se                                |
| ------------------------------------------------ | ------------------------------------------------------ |
| Cups import / cron / soft-delete                 | Rader i **samma** tenant-DB som `CUPS_DB_URL` pekar på |
| `featured_image_url` + R2 på Homebase            | Bild-URL:er i list-API                                 |
| Neon tenant connection string ändras             | Uppdatera **`CUPS_DB_URL`** på Cupappen                |
| Refaktor i `client/`, `server/` (ej public-cups) | **Ingen** deploy till Cupappen                         |

---

## Lokal utveckling

```bash
npm run dev:public-cups   # php -S port 3004, router.php
```

Lokal PHP kan falla tillbaka till `DATABASE_URL` i `.env.local` om `CUPS_DB_URL` saknas (`pdo_env.php`). Produktion ska **alltid** ha explicit `CUPS_DB_URL`.

---

## Relaterade filer

| Fil                                                                  | Innehåll                    |
| -------------------------------------------------------------------- | --------------------------- |
| [`public-cups/Dockerfile`](../public-cups/Dockerfile)                | Image med `postgresql-libs` |
| [`public-cups/railway.toml`](../public-cups/railway.toml)            | Railway config för Cupappen |
| [`public-cups/api/README.md`](../public-cups/api/README.md)          | API-endpoints               |
| [`CUPPAPPEN_PATHS_AND_STORAGE.md`](./CUPPAPPEN_PATHS_AND_STORAGE.md) | R2, dataflöde, hjältebilder |

---

## Historik

| Datum   | Händelse                                                                            |
| ------- | ----------------------------------------------------------------------------------- |
| 2026-05 | `pdo_pgsql` / `libpq` saknas i image → 500; fix `postgresql-libs` kvar i Dockerfile |
| 2026-05 | `CUPS_DB_URL` + redeploy → cup-lista åter                                           |
| 2026-05 | `deleted_at`-filter + schema-säker SQL i `db_helpers.php`                           |

Uppdatera denna tabell vid nya driftincidenter.
