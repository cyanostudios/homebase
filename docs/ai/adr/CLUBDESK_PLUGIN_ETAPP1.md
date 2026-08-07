# ADR: Clubdesk plugin — Etapp 1

**Status:** Accepted (Etapp 1) + category-ownership delta (2026-08-07)  
**Date:** 2026-08-07  
**Context:** Backoffice kiosk plugin for associations: Guides (Instructions clone) + Price list. **QA Approved** + **Security Approved** (re-review after category-delete integrity fix + form category UX). **No public companion** and **no prod release** in this etapp.

## Decision

1. **Admin plugin `clubdesk`** — `routeBase` `/api/clubdesk`, CSRF on mutations, `requirePlugin('clubdesk')`. Display name Clubdesk, `displayPrefix` CDK.
2. **Navigation (Invoices pattern)** — Sidebar submenu: Guides (`clubdesk-guides` → `/clubdesk`) + Price list (`clubdesk-price-list` → `/clubdesk/price-list`). Same tabs also as **in-page SubNav** chips in the list shell. Named segment `price-list` is reserved; guide slug `price-list` rejected. `renderCurrentPage` resolves plugins by name **or** submenu page.
3. **Guides schema (tenant, migration 119)** — `clubdesk_guides`, `clubdesk_guide_steps`, `clubdesk_guide_categories`. Same publish rule as Instructions (≥1 step). No shared tables with Instructions.
4. **Price lists schema (tenant, migration 120)** — `clubdesk_price_lists` (currency default `SEK`), `clubdesk_price_list_items` (`NUMERIC(12,2)`, category + sequence), `clubdesk_price_list_item_categories` (**per list**, `sort_order`). Published ⇒ ≥1 item. Item reorder within category. Category reorder via `PUT /price-lists/:id/categories/reorder`; list/view/API item order follows category `sort_order` then `sequence_order` (ready for a future public kiosk).
5. **Plugin access (main, migration 121)** — Grant `clubdesk`, or `npm run set:tenant-plugins -- --enable=clubdesk`. Runner: `npm run migrate:clubdesk`. After enable: **log out/in**. Migration `121` inserts grant rows for existing tenants/owners when run — use deliberate enable (`--both` / selective) on production release.
6. **Dual-domain panel** — Guides own core panel conventions (`isClubdeskPanelOpen`, `currentClubdesk`, array `clubdesk`). Price lists use parallel state; List/Form/View branch on `pathToNavPage`. Deep links: `/clubdesk/:slug` (guides), `/clubdesk/price-list/:slug` (price lists, provider + AppContent keep-open).
7. **Price bounds** — Item price validated `0 … 9999999999.99` (route + model).
8. **List shell / layout** — Plugin `contentFlush: true` + `noPrimaryAction`; ContentHeader hidden for flush plugins (including submenu pages) so lists own the in-page title. MainLayout: when flush and no ContentHeader, children scroll directly inside `MAIN_CONTENT_SHELL`. Detail forms fill the panel (no `PANEL_MAX_WIDTH` cap), Contacts-style.
9. **Guide / price-list category ownership (form)** — Catalog CRUD lives on the edit form (**Guide category** / **Item categories** cards), not Settings. Clubdesk Settings is **View only** (`ClubdeskSettingsTab = 'view'`). Assigning a guide’s `category`: click the category name on the Guide category card (click again → uncategorized). Information card has no category `Select`.
10. **Category delete + reassignment** — `DELETE /api/clubdesk/categories/:id` and `DELETE /api/clubdesk/price-lists/:id/categories/:categoryId` accept optional JSON `{ moveToCategory: string | null }`. If matching guides/items exist and the key is **absent**, API returns **409** (`needsReassignment`). Presence of `moveToCategory` (including `null`) means intentional reassignment then catalog delete. Frontend sends options **only** after dialog confirm (`withReassignment`); empty catalogs call delete with **no body**. Same integrity pattern mirrored on Instructions (see Instructions ADR).

## Out of scope (Etapp 1)

- Public PHP / `public-clubdesk` / Node companion
- Swish, messaging, VAT lines
- Production deploy (Railway / prod dual-enable without explicit release)

**Note:** Instructions category UX was later aligned with this form-owned pattern (separate plugin; documented in Instructions ADR). Tables remain separate.

## Configuration

| Item    | Value                                                                                |
| ------- | ------------------------------------------------------------------------------------ |
| Migrate | `npm run migrate:clubdesk`                                                           |
| Enable  | `npm run set:tenant-plugins -- --enable=clubdesk` (add `--both` on release / parity) |

## Security (residual, TPM-accepted)

- Freeform `featuredImageUrl` / guide step `imageUrl` (no scheme allowlist)
- Platform `db.transaction()` without auto `user_id` — mitigated by explicit ownership checks in Clubdesk models (`assertPriceListOwned` / parent auto-filter)
- Ops: migration `121` broad grant to existing tenants at migrate time — intentional local bootstrap; conscious scope at prod release (not a new code vulnerability)

Category delete mutations remain behind auth, plugin gate, CSRF, length-validated `moveToCategory`, and tenant/`price_list` ownership. FE omitting `moveToCategory` unless reassignment is confirmed preserves the 409 integrity guard (Security Approved 2026-08-07).
