# ADR: Clubdesk public companion

**Status:** Accepted (local-first) + site-content cards (2026-08-07) + request-form listing shell (2026-08-10) + Hem kort/rader (2026-08-11) + org Swish page (2026-08-11) + featured home cards (2026-08-11) + Info contacts (2026-08-11)  
**Date:** 2026-08-07  
**Context:** TPM Grind 1 — rebrand public AppShell to Clubdesk, read published clubdesk guides + price lists, home hub tiles, tabs Hem | Guides | Price list | Info. Info tab / home intro now backed by Clubdesk Info site-content cards. Etapp 1 admin ADR: [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md). Listing chrome aligned with conversational public request form (2026-08-10).

## Decision

1. **Site `public-clubdesk/`** — Pattern A PHP mini-app (port **3011** locally). Brand **Clubdesk**. **Listing shell (2026-08-10):** request-form parity for Guides/Price list/Info tabs — Poppins, violet accent, `conv-panel`, option cards; **no** gradient/blob backdrop; **keep** atmosphere grid. **Hem (2026-08-11 + featured):** CMS header (`site.home.title` + `contentHtml`, fallback “Hem”), white rounded `.home-sheet`, **featured** published guides + price lists as 3-column square cards (admin `featured` checkbox; guide image / initial fallback), then **all** guides + price lists + Swish + **Kontakt** (if any Info contacts) + Info as option rows. Guides listing tab: category groups with option cards (**no** category quick-nav). Price lists listing: option cards → `/price-list/:slug` detail with category-grouped rows + cart (**Nollställ** in subheader mini-cart clears `sessionStorage` for that slug); **Swish QR** under Att betala when a Swish profile is linked to that list (see [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md)). **Org Swish page (2026-08-11):** Hem row → `/swish/` SSR; shows primary profile (oldest non-empty `payee`) QR + number; Type C with `amount: null` and `lockMask = AMOUNT` (amount entered in Swish app). Empty/missing profile → empty state. **Info contacts (2026-08-11):** admin tab under Clubdesk Info; table `clubdesk_info_contacts` (`contact_id` FK + `blurb`); presence = published (no flag). Public list API + Hem row (only when non-empty) → `/kontakt/` SSR (name, blurb, phone, email whitelist). Info tab: CMS HTML from `info` card inside conv-panel, with static fallback when empty. **Guide detail** (`guide.php` step-swipe) keeps its own step UI (not redesigned).
2. **Same-origin PHP APIs** — `GET /api/items.php` (guides), `GET /api/price_lists.php` (price lists), `GET /api/site_content.php` (home + info HTML, allowlist-sanitized), `GET /api/info_contacts.php` (Info contacts); SQL against `clubdesk_*` (+ `contacts` join); published / content cards only; `APP_DB_URL` tenant Neon. Soft-fail: missing `clubdesk_site_content` / `clubdesk_info_contacts` returns empty. Org Swish page reads `clubdesk_swish_profiles` via SSR only (no public JSON API for payee).
3. **Node companion `plugins/public-clubdesk/`** — `routeBase` `/api/public/clubdesk`:
   - `GET /guides`, `GET /guides/:slugOrId`
   - `GET /price-lists`, `GET /price-lists/:slugOrId`
   - `GET /site-content` → `{ home: { contentHtml }, info: { contentHtml } }` (sanitized; never swish — admin Swish Type C meta stays private)  
     Unauthenticated, `publicEndpointLimiter`, owner via `PUBLIC_CLUBDESK_USER_ID` / `_EMAIL`. CORS: `PUBLIC_CLUBDESK_URL` (+ localhost:3011 in dev).
4. **Paths** — `/guides/`, `/guide/:slug`, `/price-lists/`, `/price-list/:slug`, `/swish/`, `/kontakt/`, `/kategori/:slug/`, `/info/`. Legacy `/alla/` maps to Guides in the SPA parser.
5. **`public-instructions/` stays** — Instructions plugin public site unchanged; Clubdesk is a separate public surface.
6. **No prod release** in this change — local scripts/docs only until explicit release.
7. **Featured flag** — `clubdesk_guides.featured` and `clubdesk_price_lists.featured` (BOOLEAN NOT NULL DEFAULT FALSE). Admin create/update + list-card quick select; public list JSON includes `featured`. Does **not** reuse `featured_image_url`.
8. **Info contacts** — `clubdesk_info_contacts` (migration **128**). Admin API `/api/clubdesk/info-contacts`. Soft max 50; unique `(user_id, contact_id)`.

## Configuration

| Item       | Value                                                     |
| ---------- | --------------------------------------------------------- |
| Local      | `npm run dev:public-clubdesk` → http://localhost:3011     |
| PHP DB     | `APP_DB_URL` (tenant)                                     |
| Node owner | `PUBLIC_CLUBDESK_USER_ID` or `PUBLIC_CLUBDESK_USER_EMAIL` |
| CORS       | `PUBLIC_CLUBDESK_URL`                                     |

## Consequences

- Clubdesk admin data is the sole source for this public app (guides, price lists, site-content cards, org Swish profile, Info contacts).
- Bottom tabs; Hem = CMS header + **featured** square cards + all-content option rows (guides, price lists, Swish, Kontakt when contacts exist, Info).
- CMS HTML on home/info depends on server-side allowlist sanitize + client `innerHTML` (see Security residuals in Etapp 1 ADR — awaiting TPM acceptance for Info cards).

## Security (residual)

See [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md) § Security — Info HTML residuals and Swish **SP-1**. Public endpoints are read-only; no swish/meta leakage via site-content (SQL + response limited to `home` + `info`). **Org Swish page** intentionally exposes `payee`/`message` in HTML (same class of risk as cart QR **SP-2**); profile tables remain without public JSON routes.

**Info contacts + featured (2026-08-11) — Security Approved; residual IC-1 awaiting TPM conscious acceptance:**

| ID       | Risk                                                                                                                                                                                                                                                                                      | Mitigation / notes                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IC-1** | Public PHP Info-contacts SQL (and same pattern for Swish/guides lists) does **not** filter `user_id`; isolation assumed via `APP_DB_URL` = tenant Neon. Phone/email are intentional public whitelist fields when a contact is on the list. Medium if multiple owners share one tenant DB. | Same architectural pattern as other public-clubdesk PHP reads; harden with owner filter (`PUBLIC_CLUBDESK_USER_ID` or equiv.) or accept single-owner-per-tenant. |
| **IC-2** | Public join `clubdesk_info_contacts` → `contacts` omits `c.user_id = ic.user_id` (defense-in-depth).                                                                                                                                                                                      | Admin create/update uses `assertOwnedContact`; low severity hardening.                                                                                           |

Admin Info-contacts API: auth gate, CSRF on mutations, ownership scope, blurb strip/max 500, soft max 50. Featured is a boolean on already-authenticated admin writes; public lists still require `publication_status = 'published'`.
