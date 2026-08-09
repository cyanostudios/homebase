# Public Clubdesk (Pattern A)

Clubdesk-branded public mini-app for **published guides**, **price lists**, and **Info site-content** (home intro + Info tab).

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
- `GET /api/public/clubdesk/site-content` → `{ home: { contentHtml }, info: { contentHtml } }` (allowlist-sanitized; never swish)

Env (main server): `PUBLIC_CLUBDESK_USER_ID` or `PUBLIC_CLUBDESK_USER_EMAIL`, `PUBLIC_CLUBDESK_URL`.

## Same-origin PHP APIs

| Endpoint                    | Data                                                |
| --------------------------- | --------------------------------------------------- |
| `GET /api/items.php`        | Published guides (`items` + `categoryOrder`)        |
| `GET /api/price_lists.php`  | Published price lists (`priceLists`)                |
| `GET /api/site_content.php` | Home + Info HTML cards (`home` / `info`), sanitized |

Requires `APP_DB_URL` (tenant Postgres). See `railway.env.example`. Edit content in backoffice **Clubdesk → Info**.

## Routes

| Path                | Surface                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `/`                 | Home hub (optional CMS intro + 2-col tiles: Guides, Price list)                               |
| `/guides/`          | Guides listing (Netflix rows by category)                                                     |
| `/kategori/:slug/`  | Guides category grid                                                                          |
| `/guide/:slug`      | Guide step detail                                                                             |
| `/price-lists/`     | Price list cards                                                                              |
| `/price-list/:slug` | Price list rows + cart; **Nollställ varukorg**; Swish QR under Att betala when profile linked |
| `/info/`            | Info tab (CMS from Info card; static fallback if empty)                                       |

Bottom tabs: **Hem | Guides | Price list | Info**.

## Notes

- Only `publication_status = 'published'` rows are exposed for guides/price lists.
- Site-content HTML is allowlist-sanitized on read; empty cards keep hub tiles / Info fallback copy.
- Visual design reuses the coral/beige AppShell from public-instructions; **display + heading** fonts are Plus Jakarta Sans (not Fraunces).
- Cart is per-list `sessionStorage` (`clubdesk-cart:{slug}`); round **bin** button in the subheader mini-cart clears the current list and returns to the price-list view.
- `public-instructions/` remains for the Instructions plugin; this site is Clubdesk-only.
