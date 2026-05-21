# Public Cups API (PHP)

En enkel read-only endpoint för Cupappen som hämtar publika cuper från Postgres/Neon.

## Filer

- Endpoint: `public-cups/api/cups.php`
- Dynamisk sitemap: `public-cups/api/sitemap.php` (HTML-sidans URL:er + en post per visibel cup, `Content-Type: application/xml`)
- Betyg: `public-cups/api/ratings.php`
- Liv / readiness: `public-cups/api/health.php` (`GET`, JSON `{ "status": "ok" }` vid lyckad DB-ping — används av Docker `HEALTHCHECK`)
- Delad DB-hantering: `public-cups/api/pdo_env.php` (`getPdoFromEnv()`)
- Gemensamma säkerhetsheaders: `public-cups/api/security_headers.php` (`applyPublicCupsSecurityHeaders()`)

## Krav

- PHP 8.1+ (8.2 rekommenderas)
- PHP extension: `pdo_pgsql`
- (Valfritt) `apcu` för in-memory cache

## Miljövariabler

Prioritetsordning för databasanslutning:

1. `CUPS_DB_URL` (hel connection string, t.ex. `postgres://user:pass@host/db?sslmode=require`)
2. Eller separata:
   - `CUPS_DB_HOST`
   - `CUPS_DB_NAME`
   - `CUPS_DB_USER`
   - `CUPS_DB_PASS`
   - `CUPS_DB_PORT` (valfri, default `5432`)
   - `CUPS_DB_SSLMODE` (valfri, default `require`)

Övrigt:

- `CUPS_ALLOWED_ORIGINS` (kommaseparerad lista, t.ex. `https://cupappen.se,https://www.cupappen.se`)
- `CUPS_CACHE_TTL` (sekunder, default `0` = avstängd)
- `CUPS_DEBUG_ERRORS` (`1` för detaljerade fel i utveckling, default `0`)
- `CUPS_PUBLIC_SITE_URL` (valfri, t.ex. `https://cupappen.se` – används av `sitemap.php` för `<loc>`; standard är `https://cupappen.se`)

## Exempel (Apache/Nginx env)

```bash
export CUPS_DB_URL='postgres://USER:PASS@HOST/DB?sslmode=require'
export CUPS_ALLOWED_ORIGINS='https://cupappen.se,https://www.cupappen.se'
export CUPS_CACHE_TTL='60'
```

## Svar

- `GET /api/cups.php` returnerar:

```json
{
  "cups": []
}
```

Fälten är whitelistade och matchar public-cups-modellen:  
`id`, `name`, `organizer`, `location`, `start_date`, `end_date`, `categories`, `featured`, `sanctioned`, `team_count`, `match_format`, `registration_url`, `featured_image_drive_url`, `featured_image_url`, `description`, `source_url`, `source_type`, `ingest_source_name`, `updated_at`.

## CORS

Endast origins i `CUPS_ALLOWED_ORIGINS` får `Access-Control-Allow-Origin`.  
Om variabeln är tom skickas ingen CORS allow-header.

## Driftnotering

- Endpointen är read-only (endast `GET`/`OPTIONS`)
- SQL-feltext exponeras inte i produktion (`CUPS_DEBUG_ERRORS=0`)
- Listan filtrerar `visible = true` och `deleted_at IS NULL` (samma intent som Homebase `plugins/public-cups/model.js`)
- Produktion: anropa **`https://www.cupappen.se/api/cups.php`** — apex `cupappen.se` kan redirecta `/api/*` till startsidan via Cloudflare

## Felsökning

| Test                  | Förväntat         |
| --------------------- | ----------------- |
| `GET /api/health.php` | `{"status":"ok"}` |
| `GET /api/cups.php`   | `{"cups":[...]}`  |

Om health är `unhealthy` eller cups ger 500: kontrollera `CUPS_DB_URL` på Cupappen Railway (tenant Postgres, inte Homebase main DB). Se `docs/CUPPAPPEN_PATHS_AND_STORAGE.md` §7.

## Säkerhet

- `cups.php` och `sitemap.php` sätter bl.a. `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` och en **minimal CSP** (`default-src 'none'`) på API-/XML-svar (skydd om någon försöker tolka svaret som aktivt innehåll).
- **Rate limiting** och **WAF** hanteras lämpligen i **reverse proxy** (Nginx, Cloudflare, m.m.) — inte i dessa enkla PHP-skript.
- **HSTS** (`Strict-Transport-Security`) sätts med fördel i webbservern när sajten bara servas över HTTPS.
