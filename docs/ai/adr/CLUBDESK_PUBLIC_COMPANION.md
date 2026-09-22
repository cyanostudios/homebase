# ADR: Clubdesk public companion

**Status:** Accepted (local-first) + site-content cards (2026-08-07) + request-form listing shell (2026-08-10) + Hem kort/rader (2026-08-11) + org Swish page (2026-08-11) + featured home cards (2026-08-11) + Info contacts (2026-08-11) + **installable PWA (2026-09-17)** + **card visibility + Account Profile branding (2026-09-18)**  
**Date:** 2026-08-07  
**Context:** TPM Grind 1 — rebrand public AppShell to Clubdesk, read published clubdesk guides + price lists, home hub tiles, tabs Hem | Guides | Price list | Info. Info tab / home intro now backed by Clubdesk Info site-content cards. Etapp 1 admin ADR: [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md). Listing chrome aligned with conversational public request form (2026-08-10).

## Decision

1. **Site `public-clubdesk/`** — Pattern A PHP mini-app (port **3011** locally). Brand **Clubdesk**. **Listing shell (2026-08-10):** request-form parity for Guides/Price list/Info tabs — Poppins, violet accent, `conv-panel`, option cards; **no** gradient/blob backdrop; **keep** atmosphere grid. **Hem (2026-08-11 + featured):** CMS header (`site.home.title` + `contentHtml`, fallback “Hem”), white rounded `.home-sheet`, **featured** published guides + price lists as 3-column square cards (admin `featured` checkbox; guide image / initial fallback), then **all** guides + price lists + Swish + **Kontakt** (if any Info contacts) + Info as option rows. Guides listing tab: category groups with option cards (**no** category quick-nav). Price lists listing: option cards → `/price-list/:slug` detail with category-grouped rows + cart (**Nollställ** in subheader mini-cart clears `sessionStorage` for that slug); **Swish QR** under Att betala when a Swish profile is linked to that list (see [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md)). **Org Swish page (2026-08-11):** Hem row → `/swish/` SSR; shows primary profile (oldest non-empty `payee`) QR + number; Type C with `amount: null` and `lockMask = AMOUNT` (amount entered in Swish app). Empty/missing profile → empty state. **Info contacts (2026-08-11):** admin tab under Clubdesk Info; table `clubdesk_info_contacts` (`contact_id` FK + `blurb`); presence = published (no flag). Public list API + Hem row (only when non-empty) → `/kontakt/` SSR (name, blurb, phone, email whitelist). Info tab: CMS HTML from `info` card inside conv-panel, with static fallback when empty. **Guide detail** (`guide.php` step-swipe) keeps its own step UI (not redesigned).
2. **Same-origin PHP APIs** — `GET /api/items.php` (guides), `GET /api/price_lists.php` (price lists), `GET /api/site_content.php` (home + info HTML + `contacts`/`swish`/`info` visibility flags; allowlist-sanitized), `GET /api/info_contacts.php` (Info contacts; empty when `contacts.visible=false`), `GET /api/branding.php` (Account Profile name/logo). SQL against `clubdesk_*` (+ `contacts` join); published / content cards only; `APP_DB_URL` tenant Neon. Soft-fail: missing `clubdesk_site_content` / `clubdesk_info_contacts` returns empty / visible defaults. Org Swish page reads `clubdesk_swish_profiles` via SSR only when `swish.visible` (no public JSON API for payee).
3. **Node companion `plugins/public-clubdesk/`** — `routeBase` `/api/public/clubdesk`:
   - `GET /guides`, `GET /guides/:slugOrId`
   - `GET /price-lists`, `GET /price-lists/:slugOrId`
   - `GET /site-content` → `{ home, info: { contentHtml, title, visible }, contacts: { visible }, swish: { visible } }` (sanitized; info HTML blanked when `visible=false`)
   - `GET /branding` → `{ name, logoUrl }` from main-DB `tenants.organization` (Account Profile) for `PUBLIC_CLUBDESK_USER_ID` / `_EMAIL`  
     Unauthenticated, `publicEndpointLimiter`, owner via `PUBLIC_CLUBDESK_USER_ID` / `_EMAIL`. CORS: `PUBLIC_CLUBDESK_URL` (+ localhost:3011 in dev).
4. **Paths** — `/guides/`, `/guide/:slug`, `/price-lists/`, `/price-list/:slug`, `/swish/`, `/kontakt/`, `/kategori/:slug/`, `/info/` (admin/public labels **Om** / **About**; path key remains `info`). Legacy `/alla/` maps to Guides in the SPA parser.
5. **`public-instructions/` stays** — Instructions plugin public site unchanged; Clubdesk is a separate public surface.
6. **No prod release** in this change — local scripts/docs only until explicit release. **Superseded 2026-09-17:** explicit release of installable PWA + public companion (code to `main`; Railway site service + domain still operator-configured).
7. **Featured flag** — `clubdesk_guides.featured` and `clubdesk_price_lists.featured` (BOOLEAN NOT NULL DEFAULT FALSE). Admin create/update + list-card quick select; public list JSON includes `featured`. Does **not** reuse `featured_image_url`.
8. **Info contacts** — `clubdesk_info_contacts` (migration **128**). Admin API `/api/clubdesk/info-contacts`. Soft max 50; unique `(user_id, contact_id)`.
9. **Installable PWA (2026-09-17)** — Web App Manifest (`/manifest.webmanifest`): `name`/`short_name` Clubdesk, `start_url: "/"`, `display: standalone`, `theme_color` `#7c3bed` (CSS `--brand`), icons 192/512 + apple-touch 180. Linked from listing (`index.html`) and all SSR surfaces via `api/pwa_head.php`. **No service worker** / no offline cache of guides, price lists, or Swish. Favicon: `/favicon.svg` with `/favicon.ico` → 301. Docker Caddyfile routes Clubdesk SSR (`/guide/`, `/price-list/`, `/swish/`, `/kontakt/`) — not template `/instruction/*`.
10. **Card visibility + branding (2026-09-18)** — Site-content shells `info` / `contacts` / `swish` support `meta.visible` (default true). Admin toggles under Clubdesk → Info. Public Hem hides rows when false; SSR `/swish/` + `/kontakt/` and `info_contacts` API enforce the same gate (no payee/PII leak). Sitemap omits `/info/` and `/swish/` when hidden. Org brand header: Account Profile via PHP `branding.php` / Node `/branding` (`APP_HOMEBASE_API_URL` on public PHP service in prod). Price-list cart Swish remains profile-linked and is **not** gated by `swish.visible`. Tenant CHECK on `clubdesk_site_content.card_key` must include `contacts` (migration **161**; without it admin batch-save fails).

## Configuration

| Item                    | Value                                                                                  |
| ----------------------- | -------------------------------------------------------------------------------------- |
| Local                   | `npm run dev:public-clubdesk` → http://localhost:3011                                  |
| PHP DB                  | `APP_DB_URL` (tenant)                                                                  |
| PHP → Homebase branding | `APP_HOMEBASE_API_URL` (prod); optional `APP_MAIN_DATABASE_URL` / local `DATABASE_URL` |
| Node owner              | `PUBLIC_CLUBDESK_USER_ID` or `PUBLIC_CLUBDESK_USER_EMAIL`                              |
| CORS                    | `PUBLIC_CLUBDESK_URL`                                                                  |
| PWA                     | Manifest + icons only; HTTPS required outside localhost                                |

## Consequences

- Clubdesk admin data is the sole source for this public app (guides, price lists, site-content cards, org Swish profile, Info contacts).
- Bottom tabs; Hem = CMS header + **featured** square cards + all-content option rows (guides, price lists, Swish, Kontakt when contacts exist and visible, Om/About when visible).
- CMS HTML on home/info depends on server-side allowlist sanitize + client `innerHTML` (see Security residuals in Etapp 1 ADR — awaiting TPM acceptance for Info cards).
- Members can **Add to Home Screen**; content always loads from the network (no offline data cache).
- Org header branding comes from Account Profile on the main DB (not tenant `APP_DB_URL`); public PHP proxies Homebase or reads main DB when configured.
- `meta.visible=false` on contacts/swish hides Hem rows **and** SSR/API surfaces; price-list cart Swish is independent.

## Security (residual)

See [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md) § Security — Info HTML residuals and Swish **SP-1**. Public endpoints are read-only. Site-content returns visibility flags for `contacts`/`swish` (not payee/message). **Org Swish page** intentionally exposes `payee`/`message` in HTML when `swish.visible` (same class of risk as cart QR **SP-2**); profile tables remain without public JSON routes. When `swish.visible=false` / `contacts.visible=false`, SSR and `info_contacts` return no PII/payee.

**Account Profile branding (2026-09-18) — Security Approved (Gate 5, 2026-09-18; reaffirmerad 2026-09-18 efter badge/UI WT; **reaffirmerad 2026-09-20** vid Notes tabs Gate 5):** PHP `branding.php` may call `APP_HOMEBASE_API_URL` (http(s) base only; `CURLOPT_FOLLOWLOCATION` false; short timeouts; logo URLs restricted to `http(s)` in PHP/JS/Node) or read main DB (`APP_MAIN_DATABASE_URL` / local `DATABASE_URL` + `PUBLIC_CLUBDESK_USER_ID`). Residualer oförändrade (**BR-1** Low — TPM conscious acceptance at release).

| ID          | Severity | Risk                                                                                                                                   | Mitigation / notes                                                                                                     |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **BR-1**    | Low      | Mis-set `APP_HOMEBASE_API_URL` (ops env, not attacker-controlled) causes server-side request from the public PHP service to that host. | Set only a trusted Homebase base URL in prod; optional future host allowlist. **TPM conscious acceptance at release.** |
| **CACHE-1** | Low      | APCu (`APP_CACHE_TTL`, e.g. 60s) may serve prior `info_contacts` / `site_content` payload briefly after admin hides a card.            | Accept short TTL lag; optional cache bust on admin save (non-blocking). **TPM conscious acceptance at release.**       |

**PWA installable (2026-09-17):** No service worker ⇒ no extra offline cache of PII/Swish. Manifest `start_url` is `/` (same origin). Icons are static first-party assets. Residuals **IC-1** / **SP-1** — **TPM consciously accepted at explicit prod release decision (2026-09-17)** (single-owner-per-tenant isolation via `APP_DB_URL`; Swish payee intentional in public HTML when visible).

**Info contacts + featured (2026-08-11) — Security Approved; residual IC-1 TPM-accepted at prod release 2026-09-17:**

| ID       | Risk                                                                                                                                                                                                                                                                                      | Mitigation / notes                                                                                                                                               |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **IC-1** | Public PHP Info-contacts SQL (and same pattern for Swish/guides lists) does **not** filter `user_id`; isolation assumed via `APP_DB_URL` = tenant Neon. Phone/email are intentional public whitelist fields when a contact is on the list. Medium if multiple owners share one tenant DB. | Same architectural pattern as other public-clubdesk PHP reads; harden with owner filter (`PUBLIC_CLUBDESK_USER_ID` or equiv.) or accept single-owner-per-tenant. |
| **IC-2** | Public join `clubdesk_info_contacts` → `contacts` omits `c.user_id = ic.user_id` (defense-in-depth).                                                                                                                                                                                      | Admin create/update uses `assertOwnedContact`; low severity hardening.                                                                                           |

Admin Info-contacts API: auth gate, CSRF on mutations, ownership scope, blurb strip/max 500, soft max 50. Featured is a boolean on already-authenticated admin writes; public lists still require `publication_status = 'published'`.
