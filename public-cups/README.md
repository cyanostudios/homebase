# Public Cups (Cupappen)

Publik katalog för fotbollscuper. AppShell (HTML/CSS/JS) + SSR-detaljsidor (`cup.php`). Data från `api/cups.php`.

## Sidstruktur

1. **Header** (fullbredd frosted glass) — logotyp → Hem, hamburgermeny.
2. **Hero** (Hem) — rubrik, lead, badge med cup-antal + shared filter + snabbfilter.
3. **Distriktsöversikt** (`/distrikt/`) — egen hero (preheading, titel, lead, CTA “Kontakta oss om du saknar en cup”) + A–Ö-rutnät med valkort (logo `assets/districts/{slug}.png` eller initialer). Ingen shared filter.
4. **Distriktssida** (`/{distrikt}/`, t.ex. `/skane/`) — hero (badge “X cuper publicerade”, titel, lead) + snabbfilter-badges + cupgrid. **Ingen** shared filter / CTA.
5. **Distrikt på Hem** — samma A–Ö-rutnät under cup-raderna (genväg; full översikt via `/distrikt/` / bottom bar).
6. **Shared filter** — sök, datum, kategori, distrikt (**Hem** och **Sök**).
7. **Snabbfilter-badges** — kategorier; på Hem samt listing-tabs `/kommande/`, `/alla/` och enskild distriktssida. Horisontell scroll på mobil.
8. **Rader / sökresultat** — på Hem: **Utvalda cuper** (max 3, döljs om tomt) + tidsrader **Den här månaden** / **Kommande** (+ **Passerade** där tillämpligt); kortgrid på Sök / enskilt distrikt. Listing-paths `/kommande/` och `/alla/` finns kvar utan bottom-bar-flik.
9. **Bottom bar** — Hem / Distrikt / Info (`Distrikt` aktiv även på `/{distrikt}/`).
10. **Info** (`/info/`) — arrangörs-CTA + FAQ (fade-up som hero).
11. **Cup-detalj (SSR)** — `/{distrikt}/{slug}-{år}` (t.ex. `/skane/skanskan-cup-2026`). Egen sida (`cup.php` + `cupappen-cup-detail.css`), **inte** AppShell/bottom bar. Meta-badges, sanktionerad-rad med distriktslänk, bakåt → distriktssida.

Skip-länk: `#main`.

## URL:er

| Typ               | Exempel                                                 |
| ----------------- | ------------------------------------------------------- |
| Startsida         | `/`                                                     |
| Sök               | `/sok/` (valfritt `?q=…`)                               |
| Kommande          | `/kommande/`                                            |
| Alla              | `/alla/`                                                |
| Info/FAQ          | `/info/`                                                |
| Distriktsöversikt | `/distrikt/`                                            |
| Distriktssida     | `/skane/` (m.fl.)                                       |
| Cup               | `/skane/skanskan-cup-2026`                              |
| Legacy cup        | `/cup/...` → **301** till distrikts-URL                 |
| Legacy tab        | `/#search` m.m. → normaliseras till path i JS           |
| Sitemap           | `/sitemap.xml` (hem + listing-paths + distrikt + cuper) |

Tom `ingest_source_name` → distriktsslug `ovrigt`.

URL-helpers (delade med Jest): [`lib/districtUrls.js`](lib/districtUrls.js).

### Begränsningar (verifierade)

- Ett path-segment = SPA (distrikt **eller** reserved listing-tab: `sok`, `kommande`, `alla`, `info`, `distrikt`); två segment = SSR-cup (Caddy/`router.php`).
- Reserved första-segment ska inte tolkas som distrikt — håll listorna synkade mellan `router.php`, `lib/districtUrls.js` och `cup.php` (Caddy förlitar sig främst på handle-ordning för `/api/*`).
- Vissa cupnamn som redan innehåller år kan ge slug med dubbelt år (data/namngivning).
- **Favicon:** webbläsare begär `/favicon.ico` → **301** till `/favicon.svg` (undvik SPA `index.html` som ikon).
- **Ej prod-deploy** förrän explicit release; lokal utveckling först.

## Cupkort & utlänkar

- Kort länkar till SSR-detaljsidan (`cupDetailUrl`).
- **Utlänkar (anmälan):** `utm_source=cupappen` — `lib/utm.js` + `app.js`, och `cup.php` + `api/url_helpers.php` (HTML-entities som `&amp;` avkodas före UTM).
- **Security R-UTM-1 (rekommendation):** JSON-LD tillåter bara `http(s)` på offers-URL; anmälnings-CTA i `cup.php` saknar samma allowlist — spegla gaten i ett senare pass.
- **Fallback-omslag (ingen egen `featured_image_url`):**
  - **Admin:** Cups → Inställningar → **Utseende / Fallback-bilder** — ladda upp valfritt antal (max 100) via R2/`files`; sparas i tenant-tabell `cups_site_config`.
  - **Publikt:** `GET /api/fallback_images.php`; SPA/SSR använder uppladdad pool om den inte är tom, annars statiska [`assets/fallback/`](assets/fallback/).
  - Listing/detalj hashar `cup.id` (eller namn) med samma CRC-32 som PHP — samma cup får samma fallback-bild på kort, header och relaterade.
  - Migrate: `npm run migrate:cups-site-config`.
  - **Security R-FB-1 (accepterad residual, väntar TPM):** publikt GET exponerar URL-listan — by design. **R-FB-2/R-FB-3:** https-only i prod respektive `PUBLIC_CUPS_USER_ID` rekommenderas.

## Pageviews (första-part)

- Beacon till `POST /api/pageview.php` från **cup-detalj** (`cup.php`) och **distriktssidor** (`app.js`).
- Dagliga aggregat i tenant-DB (`cupappen_pageviews_daily`). Server klassar trafikkälla (bucket + domän); ingen Google-beroende lagring.
- Admin: Homebase Cups → **Statistik** (`GET /api/cups/stats/pageviews`).
- Migration: `npm run migrate:cups-pageviews` (se [`docs/ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md`](../docs/ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md)).
- **Begränsningar:** riktningsgivande siffror (Security A1/A2); Hem/sök/listing utöver distrikt spåras inte; GTM kan finnas kvar parallellt.

## Filterkort

`.hero-search-card` / `.filter-card` i shared filter under Hem-/Sök-hero (inte på `/distrikt/` eller `/{distrikt}/`).

## API

Se [api/README.md](./api/README.md).

## Docker & Railway (produktion)

[`Dockerfile`](Dockerfile) kör **Caddy** + **PHP-FPM** (Alpine). **HEALTHCHECK** = `GET /api/health.php`.

Caddy routar:

- `/api/*` → PHP
- `/favicon.ico` → 301 `/favicon.svg`
- `/cup/*` och `/{distrikt}/{cup-slug}` → `cup.php`
- övrigt → static / SPA `index.html` (reserved listing inkl. `/distrikt/`)

Lokalt: PHP built-in + [`router.php`](router.php).

## Tester

```bash
npx jest public-cups/__tests__/districtUrls.test.js
npx jest public-cups/__tests__/referrerClassify.test.js
npx jest public-cups/__tests__/categoryFilters.test.js
npx jest public-cups/__tests__/cupDateFilters.test.js
npx jest public-cups/__tests__/utm.test.js
```
