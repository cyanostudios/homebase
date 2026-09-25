# ADR: Clubdesk inventory (Epic 1)

**Status:** Accepted (implemented; local-first)  
**Date:** 2026-09-25  
**Parent:** [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md) (same `clubdesk` plugin gate)  
**Public companion:** [`CLUBDESK_PUBLIC_COMPANION.md`](CLUBDESK_PUBLIC_COMPANION.md) (Pattern A extended)  
**Scope source:** TPM Grind 1 — garments **catalog** parity under Clubdesk; distinct DB from `garment_inventory_*`; publication like guides/price lists. **Epic 2** (price-list ↔ inventory linkage) delivered separately — see [`CLUBDESK_INVENTORY_EPIC2.md`](CLUBDESK_INVENTORY_EPIC2.md).  
**Gates:** QA Godkänt 2026-09-25; Security Godkänt 2026-09-25 (residuals INV-S7–S10 Low, non-blocking).

## Context

Clubdesk admin already covers Guides, Price list, and Info with `publication_status` and a public PHP mini-app. Garments provides a separate inventory catalog (articles, variants, tags, import) coupled to lists, person matrix, companion rail, and list assignment — that coupling is **out of scope** for Clubdesk inventory.

Epic 1 adds a third Clubdesk content domain **Inventory**: admin CRUD + settings import, and public read surfaces for **published** articles only.

## Decision

1. **Extend plugin `clubdesk`** — No new plugin key. Admin under `requirePlugin('clubdesk')`, CSRF on mutations, `routeBase` `/api/clubdesk`. Inventory routes registered **before** guide `/:id` routes (`plugins/clubdesk/routes.js`).

2. **DB prefix `clubdesk_inventory_*`** — Tenant migration **`171-clubdesk-inventory.sql`**: `clubdesk_inventory_items`, `clubdesk_inventory_variants`. Empty catalog; **no** copy from `garment_inventory_*`. Garments inventory remains behaviorally untouched.

3. **Catalog parity with garments inventory (scoped)** — Items: `article_name`, `brand`, `description`, `material`, `purchase_price`, `recommended_price`, `sale_price`, `currency` (default `SEK`), `comment`, `tags` JSONB, publication fields (`slug`, `featured_image_url`, `publication_status`, `featured`, `sort_order`). Variants: `sku`, `audience`, `color`, `size`, `quantity` (≥ 0), `sort_order`. Uniqueness: `(user_id, lower(article_name), lower(brand))`; `(user_id, lower(slug))`; variant identity `(item_id, lower(audience), lower(color), lower(size))`. **Exclude** garment list assignments, fit-summary, person matrix, public garment share, garments companion rail.

4. **Publication** — `publication_status` `draft` | `published` (default **draft**). Admin reuses `ClubdeskPublicationPropertiesFields`. **No** minimum-variant publish gate in Epic 1 (unlike guides ≥1 step / price lists ≥1 item).

5. **Admin API** — Under `/api/clubdesk/inventory`: list/create; `GET/PUT/DELETE /:id`; nested variants; `PATCH …/variants/:variantId/quantity`; `POST /inventory/import` with `items` array **max 200** (`plugins/clubdesk/routes.js`). Ownership via `user_id` on items.

6. **Nav / FE** — Submenu **Inventory** (`clubdesk-inventory` → `/clubdesk/inventory`); `inventory` reserved in `CLUBDESK_SUBPAGES` (`client/src/core/routing/clubdeskRoutes.ts`). Third domain in `ClubdeskProvider` / mail-layout List · View · Form · settings import (`ClubdeskInventorySettingsView`, settings key `clubdesk-inventory`). Import via platform ImportWizard pattern (flat rows grouped in plugin).

7. **Public companion** — Node `GET /api/public/clubdesk/inventory`, `GET /api/public/clubdesk/inventory/:slugOrId` (`plugins/public-clubdesk/`). PHP `GET /api/inventory.php`, `GET /api/inventory_detail.php` (`public-clubdesk/api/`). Filter: `publication_status = 'published'` only. Public DTO **omits** `purchase_price` and `comment` (Node transform + PHP column allowlist). Description on public SSR/SPA treated as plain text / escaped (Security INV-S6). Stock quantities on variants are public (INV-S10 accepted).

8. **Public UX (verified)** — Bottom tab **Inventory**; listing `/inventory/` (SPA); detail `/inventory/:slug` SSR (`inventory.php`, Caddy `@inventoryDetail`). Featured published articles can appear on Hem square cards (same `featured` flag pattern as guides/price lists). Edit in backoffice **Clubdesk → Inventory**.

9. **Epic 2 seam (implemented)** — Nullable FKs `inventory_item_id` / optional `inventory_variant_id` on `clubdesk_price_list_items` while keeping free-text rows — see [`CLUBDESK_INVENTORY_EPIC2.md`](CLUBDESK_INVENTORY_EPIC2.md) (migration **172**).

## Configuration

| Item              | Value                                                                               |
| ----------------- | ----------------------------------------------------------------------------------- |
| Tenant migration  | `npm run migrate:clubdesk-inventory` or `npm run migrate:clubdesk` (includes `171`) |
| Plugin access     | Same as Clubdesk (`clubdesk`); no new grant migration                               |
| Local public site | `npm run dev:public-clubdesk` → http://localhost:3011                               |
| Local admin       | Clubdesk → Inventory after migration                                                |

## Consequences

- One Clubdesk access grant covers Inventory; re-login after plugin changes if needed.
- Duplicated catalog logic vs garments until a optional shared core (future, not Epic 1).
- Public catalog adds read-only exposure class (published articles + variant qty); Security reviewed with documented Low residuals.
- Inventory may publish with zero variants (empty public article) — intentional TPM scope.

## Out of scope

- ~~Epic 2 price-list ↔ inventory linkage~~ → [`CLUBDESK_INVENTORY_EPIC2.md`](CLUBDESK_INVENTORY_EPIC2.md)
- Garments lists / companion / data migration from garments stock
- Production deploy / prod DB (local-first until explicit release)

## Security (residuals — Security Approved 2026-09-25)

| ID      | Severity | Notes                                                                                                                                          |
| ------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| INV-S7  | Low      | `featuredImageUrl` without strict scheme allowlist (same class as Clubdesk guide images)                                                       |
| INV-S8  | Low      | Import relies on bounded batch + item create path; per-field hardening optional                                                                |
| INV-S9  | Low      | PHP public reads tenant DB via `APP_DB_URL` without per-row `user_id` in SQL (single-tenant site pattern; parity with other Clubdesk PHP APIs) |
| INV-S10 | Low      | Public variant `quantity` visible on published articles                                                                                        |

Non-blocking for Epic 1 local delivery; TPM conscious acceptance at explicit prod release if applicable.
