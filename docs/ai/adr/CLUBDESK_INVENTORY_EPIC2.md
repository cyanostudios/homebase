# ADR: Clubdesk inventory ↔ price list (Epic 2)

**Status:** Accepted (implemented; local-first)  
**Date:** 2026-09-25  
**Parent:** [`CLUBDESK_INVENTORY_EPIC1.md`](CLUBDESK_INVENTORY_EPIC1.md) (seam §9)  
**Plugin:** same `clubdesk` gate as Epic 1 / [`CLUBDESK_PLUGIN_ETAPP1.md`](CLUBDESK_PLUGIN_ETAPP1.md)  
**Gates:** QA Godkänt 2026-09-25; Security Godkänt 2026-09-25 (residuals INV2-S1–S3 Low/Info, non-blocking for local-first).

## Context

Epic 1 delivered a Clubdesk inventory catalog. Price lists remained free-text rows only. Operators need to **link** a price-list line to an inventory article (optional variant) **or** keep free text, without forcing every line through inventory.

## Decision

1. **Nullable FKs on `clubdesk_price_list_items`** — Migration **`172-clubdesk-price-list-inventory-link.sql`**:
   - `inventory_item_id` → `clubdesk_inventory_items(id)` **ON DELETE SET NULL**
   - `inventory_variant_id` → `clubdesk_inventory_variants(id)` **ON DELETE SET NULL**
   - CHECK: variant requires item (`clubdesk_pli_variant_requires_item`)
   - Partial indexes on non-null FKs

2. **Two row modes (same table)** — Free text: both FKs `NULL`. Linked: `inventory_item_id` set; `inventory_variant_id` optional. Title, description, and price remain **denormalized snapshot fields** owned by the price-list row after link.

3. **No live sync** — Linking in admin copies title/price from inventory (`sale_price` → else `recommended_price` → else `0`). Later inventory edits do **not** update the price list. Unlink clears FKs and **keeps** title/price/description.

4. **Ownership validation** — On create/update with `items`, `PriceListModel.assertInventoryLinksOwned` ensures inventory item `user_id` matches the price-list owner and that any variant belongs to the linked item. Invalid FK → 400.

5. **Admin API** — Existing price-list create/update payloads accept optional `inventoryItemId` / `inventoryVariantId` per item. Detail DTO also returns joined `inventoryArticleName`, `inventorySlug`, `inventoryVariantLabel` for editor/view. No new routes; picker uses `GET /api/clubdesk/inventory`.

6. **Public** — Node + PHP price-list detail items include `inventorySlug` **only** when the linked inventory article is `publication_status = 'published'`; otherwise `null`. Public SSR (`price-list.php`) shows a quiet “Visa produkt” link to `/inventory/{slug}` when set. No inventory prices/stock on the price-list surface.

7. **FE** — `PriceListItemsEditor`: link/unlink/change via search popover + optional variant select; View: inventory meta + open in Inventory; i18n under `clubdesk.priceList.*`.

## Configuration

| Item             | Value                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Tenant migration | `npm run migrate:clubdesk-price-list-inventory-link` or `npm run migrate:clubdesk` (includes **172** after **171**) |
| Depends on       | Epic 1 tables (`171`)                                                                                               |
| Local-first      | No prod deploy unless explicitly released                                                                           |

## Consequences

- Operators can mix linked and free-text lines in one list.
- Published list prices are frozen at save time (snapshot) — intentional.
- Deleting an inventory article/variant nulls FKs; the price row remains.
- Public deep-link to inventory is opt-in via published inventory + UI link.

## Out of scope

- Livsmedelsverket / external product catalogs
- Live price sync from inventory
- Stock decrement / cart inventory binding
- Garments inventory linkage
- Production migration/deploy without explicit release

## Security (residuals — Security Approved 2026-09-25)

| ID      | Severity | Notes                                                                                                                                                                      |
| ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INV2-S1 | Low      | Express-validators for `items.*.inventoryItemId` / `inventoryVariantId` optional; model `normalizeItems` + `assertInventoryLinksOwned` enforce positive ints and ownership |
| INV2-S2 | Low      | Variant lookup has no `user_id` column; protection is item ownership + variant→item match (tenant DB isolation)                                                            |
| INV2-S3 | Info     | Public price-list snapshot **title** may name a product even if linked inventory is still draft (no `inventorySlug` in that case)                                          |

Admin: CSRF + `requirePlugin('clubdesk')`; ownership assert on inventory FKs. Public: `inventorySlug` only when inventory `published` (Node transform + PHP `CASE`). Epic 1 residuals INV-S7–S10 unchanged.

Non-blocking for Epic 2 local delivery; TPM conscious acceptance of Low residuals at explicit prod release if applicable.
