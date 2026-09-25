# ADR: Clubdesk inventory ↔ price list (Epic 2)

**Status:** Accepted (implemented; local-first)  
**Date:** 2026-09-25  
**Parent:** [`CLUBDESK_INVENTORY_EPIC1.md`](CLUBDESK_INVENTORY_EPIC1.md) (seam §9)  
**Plugin:** same `clubdesk` gate as Epic 1 / [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md)  
**Gates:** QA Godkänt 2026-09-25 (Epic 2 link + dual-price/UI polish re-review); Security Godkänt 2026-09-25 (residuals **INV2-S1–S5** Low/Info, non-blocking for local-first).

## Context

Epic 1 delivered a Clubdesk inventory catalog. Price lists remained free-text rows only. Operators need to **link** a price-list line to an inventory article (optional variant) **or** keep free text, without forcing every line through inventory.

## Decision

1. **Nullable FKs on `clubdesk_price_list_items`** — Migration **`172-clubdesk-price-list-inventory-link.sql`**:
   - `inventory_item_id` → `clubdesk_inventory_items(id)` **ON DELETE SET NULL**
   - `inventory_variant_id` → `clubdesk_inventory_variants(id)` **ON DELETE SET NULL**
   - CHECK: variant requires item (`clubdesk_pli_variant_requires_item`)
   - Partial indexes on non-null FKs

2. **Two row modes (same table)** — Free text: both FKs `NULL`. Linked: `inventory_item_id` set; `inventory_variant_id` optional. Title and description remain denormalized on the price-list row after link.

3. **Dual price (migration `173`)** — Column `price_override` (nullable). Linked rows expose:
   - **Inventory price** — live catalog from joined inventory (`sale_price` → else `recommended_price`); read-only in admin.
   - **List price** — optional free override (`price_override`). Empty/null → public and admin effective price follows inventory catalog. Column `price` stores the resolved effective value on save for free-text rows and as fallback.
     Linking clears `price_override` and seeds catalog into `price`. Unlink clears FKs / catalog display and **keeps** title/description/list values.

4. **Ownership validation** — On create/update with `items`, `PriceListModel.assertInventoryLinksOwned` ensures inventory item `user_id` matches the price-list owner and that any variant belongs to the linked item. Invalid FK → 400.

5. **Admin API** — Existing price-list create/update payloads accept optional `inventoryItemId` / `inventoryVariantId` / `priceOverride` per item. Detail DTO also returns joined `inventoryArticleName`, `inventorySlug`, `inventoryVariantLabel`, `inventoryCatalogPrice` for editor/view. No new routes; picker uses `GET /api/clubdesk/inventory`.

6. **Public** — Effective item `price` = `COALESCE(price_override, inventory.sale_price, inventory.recommended_price, price)`. Node + PHP. Also `inventorySlug` **only** when the linked inventory article is `publication_status = 'published'`; otherwise `null`. Public SSR (`price-list.php`) shows a quiet “Visa produkt” link to `/inventory/{slug}` when set. No stock on the price-list surface.

7. **FE** — `PriceListItemsEditor`: linked rows show inventory price + list price; free-text rows show a single price field. View uses effective price. i18n under `clubdesk.priceList.*`.

## Configuration

| Item             | Value                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tenant migration | `npm run migrate:clubdesk` (includes **172** + **173**) or `migrate:clubdesk-price-list-inventory-link` / `migrate:clubdesk-price-list-price-override` |
| Depends on       | Epic 1 tables (`171`); dual price needs **173** after **172**                                                                                          |
| Local-first      | No prod deploy unless explicitly released                                                                                                              |

## Consequences

- Operators can mix linked and free-text lines in one list.
- Linked rows without `price_override` follow live inventory sale/recommended on read and public display.
- Free list price (`price_override`) freezes the public amount until cleared.
- Admin editor/view also re-sync catalog (and effective price when following) from the in-memory inventory list when a product’s sale/recommended price changes — no manual “update list price” action.
- Deleting an inventory article/variant nulls FKs; the price row remains.
- Public deep-link to inventory is opt-in via published inventory + UI link.

## Out of scope

- Livsmedelsverket / external product catalogs
- Stock decrement / cart inventory binding
- Garments inventory linkage
- Production migration/deploy without explicit release

## Security (residuals — Security Approved 2026-09-25)

| ID      | Severity | Notes                                                                                                                                                                                                                                     |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV2-S1 | Low      | Express-validators for `items.*.inventoryItemId` / `inventoryVariantId` optional; model `normalizeItems` + `assertInventoryLinksOwned` enforce positive ints and ownership                                                                |
| INV2-S2 | Low      | Variant lookup has no `user_id` column; protection is item ownership + variant→item match (tenant DB isolation)                                                                                                                           |
| INV2-S3 | Info     | Public price-list snapshot **title** may name a product even if linked inventory is still draft (no `inventorySlug` in that case)                                                                                                         |
| INV2-S4 | Low      | `applyCatalogPricesWhenFollowingInventory` SELECTs inventory by id without `user_id` — mitigated by `assertInventoryLinksOwned` before insert/update; optional defense-in-depth filter                                                    |
| INV2-S5 | Info     | Public effective `price` `COALESCE(price_override, sale, recommended, price)` uses inventory sale/recommended **regardless of inventory publication_status** (slug still gated). `purchase_price` never exposed. Intentional live catalog |

Admin: CSRF + `requirePlugin('clubdesk')`; ownership assert on inventory FKs; `items.*.priceOverride` validated (0…max). Public: `inventorySlug` only when inventory `published` (Node transform + PHP `CASE`). Epic 1 residuals INV-S7–S10 unchanged.

Non-blocking for Epic 2 / dual-price local delivery; TPM conscious acceptance of Low residuals at explicit prod release if applicable.
