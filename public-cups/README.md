# Public Cups (Cupappen)

Publik katalog för fotbollscuper. AppShell (HTML/CSS/JS) + SSR-detaljsidor (`cup.php`). Data från `api/cups.php`.

## Sidstruktur

1. **Header** (fullbredd frosted glass) — logotyp → Hem, hamburgermeny.
2. **Hero** (Hem) — rubrik, lead, badge med cup-antal.
3. **Distriktssida** (`/{distrikt}/`, t.ex. `/skane/`) — titel + lead om distriktsförbundet.
4. **Shared filter** — sök, datum, kategori, distrikt (Hem / Sök / distriktssida).
5. **Snabbfilter-badges** — kategorier; horisontell scroll på mobil, centrerad wrap från 600px.
6. **Rader / sökresultat** — Netflix-rader (Hem/Kommande/Alla) eller kortgrid (Sök/distrikt).
7. **Bottom bar** — Hem / Kommande / Alla / Sök / Info.
8. **Cup-detalj (SSR)** — `/{distrikt}/{slug}-{år}` (t.ex. `/skane/skanskan-cup-2026`). Egen sida (`cup.php` + `cupappen-cup-detail.css`), **inte** AppShell/bottom bar.

Skip-länk: `#main`.

## URL:er

| Typ        | Exempel                                                 |
| ---------- | ------------------------------------------------------- |
| Startsida  | `/`                                                     |
| Sök        | `/sok/` (valfritt `?q=…`)                               |
| Kommande   | `/kommande/`                                            |
| Alla       | `/alla/`                                                |
| Info/FAQ   | `/info/`                                                |
| Distrikt   | `/skane/`                                               |
| Cup        | `/skane/skanskan-cup-2026`                              |
| Legacy cup | `/cup/...` → **301** till distrikts-URL                 |
| Legacy tab | `/#search` m.m. → normaliseras till path i JS           |
| Sitemap    | `/sitemap.xml` (hem + listing-paths + distrikt + cuper) |

Tom `ingest_source_name` → distriktsslug `ovrigt`.

URL-helpers (delade med Jest): [`lib/districtUrls.js`](lib/districtUrls.js).

### Begränsningar (verifierade)

- Ett path-segment = SPA (distrikt **eller** reserved listing-tab: `sok`, `kommande`, `alla`, `info`); två segment = SSR-cup (Caddy/`router.php`).
- Reserved första-segment ska inte tolkas som distrikt — håll listorna synkade mellan `router.php`, `lib/districtUrls.js` och `cup.php` (Caddy förlitar sig främst på handle-ordning för `/api/*`).
- Vissa cupnamn som redan innehåller år kan ge slug med dubbelt år (data/namngivning).
- **Ej prod-deploy** förrän explicit release; lokal utveckling först.

## Cupkort & utlänkar

- Kort länkar till SSR-detaljsidan (`cupDetailUrl`).
- **Utlänkar (anmälan):** `utm_source=cupappen` — `app.js` (`withCupappenUtm`) och `cup.php` + `api/url_helpers.php`.

## Pageviews (första-part)

- Beacon till `POST /api/pageview.php` från **cup-detalj** (`cup.php`) och **distriktssidor** (`app.js`).
- Dagliga aggregat i tenant-DB (`cupappen_pageviews_daily`). Server klassar trafikkälla (bucket + domän); ingen Google-beroende lagring.
- Admin: Homebase Cups → **Statistik** (`GET /api/cups/stats/pageviews`).
- Migration: `npm run migrate:cups-pageviews` (se [`docs/ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md`](../docs/ai/adr/CUPAPPEN_FIRST_PARTY_PAGEVIEWS.md)).
- **Begränsningar:** riktningsgivande siffror (Security A1/A2); Hem/sök/listing utöver distrikt spåras inte; GTM kan finnas kvar parallellt.

## Filterkort

`.hero-search-card` / `.filter-card` i shared filter under hero/distriktsheader.

## API

Se [api/README.md](./api/README.md).

## Docker & Railway (produktion)

[`Dockerfile`](Dockerfile) kör **Caddy** + **PHP-FPM** (Alpine). **HEALTHCHECK** = `GET /api/health.php`.

Caddy routar:

- `/api/*` → PHP
- `/cup/*` och `/{distrikt}/{cup-slug}` → `cup.php`
- övrigt → static / SPA `index.html`

Lokalt: PHP built-in + [`router.php`](router.php).

## Tester

```bash
npx jest public-cups/__tests__/districtUrls.test.js
npx jest public-cups/__tests__/referrerClassify.test.js
```
