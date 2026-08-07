# ADR: Clubdesk plugin — Etapp 1

**Status:** Accepted (Etapp 1) + category-ownership delta (2026-08-07) + public companion (2026-08-07) + Info site content (2026-08-07) + Swish QR wiring (2026-08-07) + **Swish profiles ↔ price lists (2026-08-07)**  
**Date:** 2026-08-07  
**Context:** Backoffice kiosk plugin for associations: Guides (Instructions clone) + Price list + Info content cards. Category-delete integrity: **QA Approved** + **Security Approved**. Info site content (migration 122): **QA Approved** + **Security Approved** (HTML residuals below await TPM conscious acceptance). Early singleton Swish-in-meta wiring superseded by **Swish profiles** (migration 123): **QA Approved** + **Security Approved**; residual **SP-1** awaits TPM conscious acceptance — see [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md). Public companion: [`CLUBDESK_PUBLIC_COMPANION.md`](CLUBDESK_PUBLIC_COMPANION.md) (local-first; **no prod release**).

## Decision

1. **Admin plugin `clubdesk`** — `routeBase` `/api/clubdesk`, CSRF on mutations, `requirePlugin('clubdesk')`. Display name Clubdesk, `displayPrefix` CDK.
2. **Navigation (Invoices pattern)** — Sidebar submenu: Guides (`clubdesk-guides` → `/clubdesk`) + Price list (`clubdesk-price-list` → `/clubdesk/price-list`) + Info (`clubdesk-info` → `/clubdesk/info`). Named segments `price-list` and `info` are reserved; guide slugs rejected. `renderCurrentPage` resolves plugins by name **or** submenu page.
3. **Guides schema (tenant, migration 119)** — `clubdesk_guides`, `clubdesk_guide_steps`, `clubdesk_guide_categories`. Same publish rule as Instructions (≥1 step). No shared tables with Instructions.
4. **Price lists schema (tenant, migration 120)** — `clubdesk_price_lists` (currency default `SEK`), `clubdesk_price_list_items` (`NUMERIC(12,2)`, category + sequence), `clubdesk_price_list_item_categories` (**per list**, `sort_order`). Published ⇒ ≥1 item. Item reorder within category. Category reorder via `PUT /price-lists/:id/categories/reorder`; list/view/API item order follows category `sort_order` then `sequence_order` (ready for a future public kiosk).
5. **Plugin access (main, migration 121)** — Grant `clubdesk`, or `npm run set:tenant-plugins -- --enable=clubdesk`. Runner: `npm run migrate:clubdesk`. After enable: **log out/in**. Migration `121` inserts grant rows for existing tenants/owners when run — use deliberate enable (`--both` / selective) on production release.
6. **Dual-domain panel** — Guides own core panel conventions (`isClubdeskPanelOpen`, `currentClubdesk`, array `clubdesk`). Price lists use parallel state; List/Form/View branch on `pathToNavPage`. Deep links: `/clubdesk/:slug` (guides), `/clubdesk/price-list/:slug` (price lists, provider + AppContent keep-open).
7. **Info site content (tenant, migration 122)** — Singleton page `/clubdesk/info` (`ClubdeskInfoView`) with fixed cards (`home`, `info`, `swish`) in `clubdesk_site_content` (`content` TEXT, `meta` JSONB). TipTap/plain HTML for home/info. **Swish card** is a UI shell only (`content`/`meta` forced empty). Type C data lives in **Swish profiles** (decision 12). Public: sanitized `home` + `info` only (never swish).
8. **Price bounds** — Item price validated `0 … 9999999999.99` (route + model).
9. **List shell / layout** — Plugin `contentFlush: true` + `noPrimaryAction`; ContentHeader hidden for flush plugins (including submenu pages) so lists own the in-page title. MainLayout: when flush and no ContentHeader, children scroll directly inside `MAIN_CONTENT_SHELL`. Detail forms fill the panel (no `PANEL_MAX_WIDTH` cap), Contacts-style.
10. **Guide / price-list category ownership (form)** — Catalog CRUD lives on the edit form (**Guide category** / **Item categories** cards), not Settings. Clubdesk Settings is **View only** (`ClubdeskSettingsTab = 'view'`). Assigning a guide’s `category`: click the category name on the Guide category card (click again → uncategorized). Information card has no category `Select`.
11. **Category delete + reassignment** — `DELETE /api/clubdesk/categories/:id` and `DELETE /api/clubdesk/price-lists/:id/categories/:categoryId` accept optional JSON `{ moveToCategory: string | null }`. If matching guides/items exist and the key is **absent**, API returns **409** (`needsReassignment`). Presence of `moveToCategory` (including `null`) means intentional reassignment then catalog delete. Frontend sends options **only** after dialog confirm (`withReassignment`); empty catalogs call delete with **no body**. Same integrity pattern mirrored on Instructions (see Instructions ADR).
12. **Swish profiles (tenant, migration 123)** — `clubdesk_swish_profiles` (`payee`, `message`; no amount) + `clubdesk_swish_profile_price_lists` (M:N; **unique `price_list_id`**). Admin CRUD `GET/POST/PUT/DELETE /api/clubdesk/swish-profiles` (CSRF; soft max 50). UI: Info → Swish multi-profile + tags-like price-list links + PNG QR via `@/core/qr` (`lockMask` = amount editable). Migrates former singleton `swish.meta` into first profile. ADR: [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md). Public cart QR **out of scope**.

## Out of scope (Etapp 1 admin)

- Public kiosk / cart display of Swish QR, messaging, VAT lines, Swish commerce/token (Type D)
- Production deploy (Railway / prod dual-enable without explicit release)

**Public companion:** see [`CLUBDESK_PUBLIC_COMPANION.md`](CLUBDESK_PUBLIC_COMPANION.md) (`public-clubdesk/` + `plugins/public-clubdesk/`).

**Note:** Instructions category UX was later aligned with this form-owned pattern (separate plugin; documented in Instructions ADR). Tables remain separate.

## Configuration

| Item    | Value                                                                                |
| ------- | ------------------------------------------------------------------------------------ |
| Migrate | `npm run migrate:clubdesk` (tenant: 119, 120, **122**, **123**; main grant: 121)     |
| Enable  | `npm run set:tenant-plugins -- --enable=clubdesk` (add `--both` on release / parity) |

## Security (residuals)

**Previously TPM-accepted (category / Etapp 1):**

- Freeform `featuredImageUrl` / guide step `imageUrl` (no scheme allowlist)
- Platform `db.transaction()` without auto `user_id` — mitigated by explicit ownership checks in Clubdesk models (`assertPriceListOwned` / parent auto-filter)
- Ops: migration `121` broad grant to existing tenants at migrate time — intentional local bootstrap; conscious scope at prod release (not a new code vulnerability)

Category delete mutations remain behind auth, plugin gate, CSRF, length-validated `moveToCategory`, and tenant/`price_list` ownership. FE omitting `moveToCategory` unless reassignment is confirmed preserves the 409 integrity guard (Security Approved 2026-08-07).

**Info site content — Security Approved; awaiting TPM conscious acceptance:**

- Admin stores TipTap HTML behind auth / CSRF / `requirePlugin('clubdesk')` (same class of risk as Notes; route validation is length-capped string, equivalent in practice to `htmlContent` helper)
- Public read uses a **custom regex allowlist sanitizer** (Node + PHP), then the kiosk renders via `innerHTML`. Weaker than a maintained HTML sanitizer library; writers are authenticated Clubdesk users only. Public AppShell CSP still allows `script-src 'unsafe-inline'` (existing Pattern A baseline)

**Swish QR wiring (2026-08-07) — superseded for storage by Swish profiles:**

Early admin wiring stored Type C fields in `swish.meta` (residual **SW-1**). That storage path is **replaced** by migration 123 profiles; `swish.meta` is forced `{}`. See **SP-1** below / [`CLUBDESK_SWISH_PROFILES.md`](CLUBDESK_SWISH_PROFILES.md).

**Swish profiles (2026-08-07) — Security Approved; residual SP-1 awaiting TPM conscious acceptance:**

| ID   | Risk                                                                                | Mitigation / acceptans                                                                                                    |
| ---- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| SP-1 | Multiple Swish `payee`/`message` rows in tenant tables (payment-routing admin data) | Auth + plugin gate + CSRF; ownership on profiles and linked price lists; soft max 50; **never** on public APIs in Grind 1 |

**Hardening (out of scope for this change):** replace regex sanitizer with a maintained library; tighten public CSP; etapp 2 public cart QR Security review.
