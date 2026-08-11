# Public Clubdesk (Pattern A)

Clubdesk-branded public mini-app for **published guides**, **price lists**, **Info site-content** (home intro + Info tab), **org Swish**, and **Info contacts** (`/kontakt/`).

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

| Endpoint                     | Data                                                              |
| ---------------------------- | ----------------------------------------------------------------- |
| `GET /api/items.php`         | Published guides (`items` + `categoryOrder`; includes `featured`) |
| `GET /api/price_lists.php`   | Published price lists (`priceLists`; includes `featured`)         |
| `GET /api/site_content.php`  | Home + Info HTML cards (`home` / `info`), sanitized               |
| `GET /api/info_contacts.php` | Info contacts whitelist (`name`, `phone`, `email`, `blurb`)       |

Requires `APP_DB_URL` (tenant Postgres). See `railway.env.example`. Edit content in backoffice **Clubdesk** (guides/price lists) and **Clubdesk → Info** (site content, Swish profiles, Kontakt).

## Routes

| Path                | Surface                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/`                 | Hem: CMS-header, **featured** square cards, then option rows (all guides/price lists + Swish + Kontakt if any + Info) |
| `/guides/`          | Guides listing (kategorier + option cards)                                                                            |
| `/kategori/:slug/`  | Guides category listing                                                                                               |
| `/guide/:slug`      | Guide step detail                                                                                                     |
| `/price-lists/`     | Price list cards                                                                                                      |
| `/price-list/:slug` | Price list rows + cart; **Nollställ varukorg**; Swish QR under Att betala when profile linked                         |
| `/swish/`           | Org Swish QR + nummer (äldsta profil med payee; belopp anges i appen)                                                 |
| `/kontakt/`         | Info contacts SSR list (name, blurb, phone, email); empty when none                                                   |
| `/info/`            | Info tab (CMS from Info card; static fallback if empty)                                                               |

Bottom tabs: **Hem | Guides | Price list**. Info, Swish och Kontakt nås via rader på Hem (Kontakt endast när listan har rader).

## Notes

- Only `publication_status = 'published'` rows are exposed for guides/price lists. `featured` controls Hem square cards only (not publication).
- Info contacts: presence = published (no flag); empty list → no Hem row / empty `/kontakt/` state.
- Site-content HTML is allowlist-sanitized on read; empty cards keep hub tiles / Info fallback copy.
- Visual design: request-form-inspired listing shell (Poppins, violet); see [`docs/PUBLIC_APP_DESIGN.md`](../docs/PUBLIC_APP_DESIGN.md) + ADR [`CLUBDESK_PUBLIC_COMPANION.md`](../docs/ai/adr/CLUBDESK_PUBLIC_COMPANION.md).
- Cart is per-list `sessionStorage` (`clubdesk-cart:{slug}`); round **bin** button in the subheader mini-cart clears the current list and returns to the price-list view.
- `public-instructions/` remains for the Instructions plugin; this site is Clubdesk-only.
- Security residual **IC-1** (PHP reads without `user_id` filter; tenant via `APP_DB_URL`) — see ADR Security section; awaiting TPM acceptance.
