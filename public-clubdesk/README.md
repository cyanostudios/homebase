# Public Clubdesk (Pattern A)

Clubdesk-branded public mini-app for **published guides**, **price lists**, **site-content** (home intro + **Om/About** tab), **org Swish**, and **contacts** (`/kontakt/`).

## Local

```bash
# Ensure APP_DB_URL points at the tenant Neon DB (same as clubdesk admin data)
npm run dev:public-clubdesk
# → http://localhost:3011
```

Optional Node companion (Homebase API, CORS via `PUBLIC_CLUBDESK_URL`):

- `GET /api/public/clubdesk/guides` → `{ guides, categoryOrder }`
- `GET /api/public/clubdesk/guides/:slugOrId`
- `GET /api/public/clubdesk/price-lists` → `{ priceLists }`
- `GET /api/public/clubdesk/price-lists/:slugOrId`
- `GET /api/public/clubdesk/site-content` → `{ home, info: { contentHtml, title, visible }, contacts: { visible }, swish: { visible } }` (allowlist-sanitized; info blanked when `visible=false`)
- `GET /api/public/clubdesk/branding` → `{ name, logoUrl }` from Account Profile / Settings → Profile (`tenants.organization`)

Env (main server): `PUBLIC_CLUBDESK_USER_ID` or `PUBLIC_CLUBDESK_USER_EMAIL`, `PUBLIC_CLUBDESK_URL`.

## Same-origin PHP APIs

| Endpoint                     | Data                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------ |
| `GET /api/items.php`         | Published guides (`items` + `categoryOrder`; includes `featured`)                          |
| `GET /api/price_lists.php`   | Published price lists (`priceLists`; includes `featured`)                                  |
| `GET /api/site_content.php`  | Home + Om/About HTML + `contacts`/`swish`/`info` `visible` flags, sanitized                |
| `GET /api/branding.php`      | Org `name` + `logoUrl` from Account Profile (`tenants.organization`)                       |
| `GET /api/info_contacts.php` | Contacts whitelist (`name`, `phone`, `email`, `blurb`); `[]` when `contacts.visible=false` |

Requires `APP_DB_URL` (tenant Postgres). See `railway.env.example`. Edit content in backoffice **Clubdesk** (guides/price lists) and **Clubdesk → Info** (site content, Swish profiles, Kontakt).

## Routes

| Path                | Surface                                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/`                 | Hem: CMS-header, **featured** square cards, then option rows (guides/price lists + Swish/Kontakt/Om when visible) |
| `/guides/`          | Guides listing (kategorier + option cards)                                                                        |
| `/kategori/:slug/`  | Guides category listing                                                                                           |
| `/guide/:slug`      | Guide step detail                                                                                                 |
| `/price-lists/`     | Price list cards                                                                                                  |
| `/price-list/:slug` | Price list rows + cart; **Nollställ varukorg**; Swish QR under Att betala when profile linked                     |
| `/swish/`           | Org Swish QR + nummer; empty when site-content `swish.visible=false`                                              |
| `/kontakt/`         | Contacts list; empty when `contacts.visible=false` (API returns `items: []`)                                      |
| `/info/`            | Om/About tab (CMS; blanked when `info.visible=false`)                                                             |

Bottom tabs: **Hem | Guides | Price list**. Om/About, Swish och Kontakt nås via rader på Hem (när respektive `visible` och Kontakt har rader).

## PWA (installable)

Installerbar utan offline-cache (ingen service worker):

| Asset       | Path                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| Manifest    | `/manifest.webmanifest` (`display: standalone`, `start_url: /`)             |
| Icons       | `/icons/icon-192.png`, `/icons/icon-512.png`, `/icons/apple-touch-icon.png` |
| Favicon     | `/favicon.svg` + PNG `/icons/favicon-32.png` ( `/favicon.ico` → PNG )       |
| Shared meta | `api/pwa_head.php` on SSR pages; same tags in `index.html`                  |

Theme color `#7c3bed` matches CSS `--brand`. Chrome/Safari: **Lägg till på hemskärmen** på `http://localhost:3011` (HTTP OK lokalt; prod kräver HTTPS).

## Production deploy checklist (ops — only after explicit release)

Canonical prod URL: **`https://clubdesk.livesolutions.se`**.

Separate Railway service (not Homebase Node). Pattern: [`docs/PUBLIC_APP_TEMPLATE.md`](../docs/PUBLIC_APP_TEMPLATE.md).

1. Residuals **IC-1** / **SP-1** TPM-accepted at release (2026-09-17). Branding residuals **BR-1** / **CACHE-1** — TPM conscious acceptance at next explicit release (see ADR).
2. Publish Clubdesk content (`publication_status = published`) — tenant currently may have zero published rows until admin publishes.
3. Confirm `docker/Caddyfile` routes `/guide/`, `/price-list/`, `/swish/`, `/kontakt/` (not `/instruction/`).
4. New Railway service: **Root Directory** = `public-clubdesk`, Dockerfile builder, branch `main`.
5. Vars (paste from local gitignored helpers `.env.railway.clubdesk-site` / `.env.railway.clubdesk-homebase`):
   - `APP_DB_URL` = **tenant** Neon (never main `DATABASE_URL`)
   - `APP_PUBLIC_URL=https://clubdesk.livesolutions.se`
   - `APP_ALLOWED_ORIGINS=https://clubdesk.livesolutions.se`
   - `APP_HOMEBASE_API_URL` = trusted Homebase Node base (org branding); optional `APP_MAIN_DATABASE_URL` + `PUBLIC_CLUBDESK_USER_ID` for direct main-DB read
6. Custom domain `clubdesk.livesolutions.se` + TLS (DNS CNAME → Railway); healthcheck `/api/health.php`.
7. Verify health, `/api/items.php`, `/api/branding.php`, sitemap, SSR guide/price-list/swish/kontakt visibility gates, phone PWA install.
8. On Homebase API: `PUBLIC_CLUBDESK_URL=https://clubdesk.livesolutions.se`, `PUBLIC_CLUBDESK_USER_ID=3` (or `_EMAIL=mario.nasr@sorgenfriff.se`).
9. Tenant migration **161** applied if Info batch-save needs `contacts` card_key (`npm run migrate:clubdesk-site-content-contacts-card`).
10. Plugin access for tenant; log out/in admin.

## Notes

- Only `publication_status = 'published'` rows are exposed for guides/price lists. `featured` controls Hem square cards only (not publication).
- Info contacts: presence = published (no flag); empty list → no Hem row / empty `/kontakt/` state. `meta.visible=false` on contacts also forces API `items: []` and empty SSR.
- Site-content HTML is allowlist-sanitized on read; empty cards keep hub tiles / Info fallback copy.
- Visual design: request-form-inspired listing shell (Poppins, violet); see [`docs/PUBLIC_APP_DESIGN.md`](../docs/PUBLIC_APP_DESIGN.md) + ADR [`CLUBDESK_PUBLIC_COMPANION.md`](../docs/ai/adr/CLUBDESK_PUBLIC_COMPANION.md).
- Cart is per-list `sessionStorage` (`clubdesk-cart:{slug}`); round **bin** button in the subheader mini-cart clears the current list and returns to the price-list view.
- `public-instructions/` remains for the Instructions plugin; this site is Clubdesk-only.
- Security: **IC-1** TPM-accepted 2026-09-17; branding **BR-1** / **CACHE-1** documented in ADR for TPM at next release.
