# ADR: Clubdesk public companion

**Status:** Accepted (local-first) + site-content cards (2026-08-07)  
**Date:** 2026-08-07  
**Context:** TPM Grind 1 — rebrand public AppShell to Clubdesk, read published clubdesk guides + price lists, home hub tiles, tabs Hem | Guides | Price list | Info. Info tab / home intro now backed by Clubdesk Info site-content cards. Etapp 1 admin ADR: [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md).

## Decision

1. **Site `public-clubdesk/`** — Pattern A PHP mini-app (port **3011** locally). Brand **Clubdesk**; coral/beige AppShell tokens unchanged from public-instructions. Home: **2-column hub** tiles (Guides, Price list) plus optional CMS intro from Info→Hem (`home` card). Guides listing: Netflix/grid by category (**no** category quick-nav). Price lists: card grid → `/price-list/:slug` detail with category-grouped rows + cart; **Swish QR** under Att betala when a Swish profile is linked to that list (see [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md)). Info tab: CMS HTML from `info` card, with static fallback when empty.
2. **Same-origin PHP APIs** — `GET /api/items.php` (guides), `GET /api/price_lists.php` (price lists), `GET /api/site_content.php` (home + info HTML, allowlist-sanitized); SQL against `clubdesk_*` tables; published / content cards only; `APP_DB_URL` tenant Neon. Soft-fail: missing `clubdesk_site_content` table returns empty cards.
3. **Node companion `plugins/public-clubdesk/`** — `routeBase` `/api/public/clubdesk`:
   - `GET /guides`, `GET /guides/:slugOrId`
   - `GET /price-lists`, `GET /price-lists/:slugOrId`
   - `GET /site-content` → `{ home: { contentHtml }, info: { contentHtml } }` (sanitized; never swish — admin Swish Type C meta stays private)  
     Unauthenticated, `publicEndpointLimiter`, owner via `PUBLIC_CLUBDESK_USER_ID` / `_EMAIL`. CORS: `PUBLIC_CLUBDESK_URL` (+ localhost:3011 in dev).
4. **Paths** — `/guides/`, `/guide/:slug`, `/price-lists/`, `/price-list/:slug`, `/kategori/:slug/`, `/info/`. Legacy `/alla/` maps to Guides in the SPA parser.
5. **`public-instructions/` stays** — Instructions plugin public site unchanged; Clubdesk is a separate public surface.
6. **No prod release** in this change — local scripts/docs only until explicit release.

## Configuration

| Item       | Value                                                     |
| ---------- | --------------------------------------------------------- |
| Local      | `npm run dev:public-clubdesk` → http://localhost:3011     |
| PHP DB     | `APP_DB_URL` (tenant)                                     |
| Node owner | `PUBLIC_CLUBDESK_USER_ID` or `PUBLIC_CLUBDESK_USER_EMAIL` |
| CORS       | `PUBLIC_CLUBDESK_URL`                                     |

## Consequences

- Clubdesk admin data is the sole source for this public app (guides, price lists, site-content cards).
- Four bottom tabs; hub grid CSS ready for additional tiles later.
- CMS HTML on home/info depends on server-side allowlist sanitize + client `innerHTML` (see Security residuals in Etapp 1 ADR — awaiting TPM acceptance for Info cards).

## Security (residual)

See [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md) § Security — Info HTML residuals and Swish **SP-1**. Public endpoints are read-only; no swish/meta leakage (SQL + response limited to `home` + `info`). Profile tables are admin-only (no public companion routes in Grind 1).
