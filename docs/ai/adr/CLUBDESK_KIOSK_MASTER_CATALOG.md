# ADR: Clubdesk kiosk master catalog seed

**Status:** Accepted (implemented; local-first)  
**Date:** 2026-09-30  
**Scope:** Clubdesk inventory only. Garments unchanged.  
**Parent scope:** TPM Grind 1 — kiosk master catalog Sverige (verified JSON).

## Context

Clubs need a shared kiosk product list (355 rows, 14 categories) inside Clubdesk inventory so articles can be linked on price lists. Most enrichment fields are empty today but must exist for later fills. Plugin access lives on the main DB; inventory lives on the tenant DB. The user import API caps at 200 items. Creating a variant solely to store GTIN/size would force variant selection in the price-list picker.

## Decision

1. **Versioned seed file** in-repo under `plugins/clubdesk/seeds/` (catalog seed version 1). System seed reads this file only.

2. **Extend `clubdesk_inventory_items`** with flat columns: `catalog_key`, `category`, `package_size`, `package_unit`, item-level `gtin`, `article_number`, `ingredients`, `allergens`, seven nullable nutrition numerics per 100g, `net_content`, `country_of_origin`, `country_of_manufacture`, `supplier`, `catalog_source`, `verified_at`, `data_status`. Map `image_url` → `featured_image_url` only when non-empty. Do not archive from seed `active`.

3. **No catalog variants.** Package size and item GTIN are item fields. Seed inserts zero variants so price-list linking stays direct.

4. **Keep** partial unique `(user_id, lower(article_name), lower(brand))` for active rows. **Add** unique `(user_id, catalog_key)` where key non-empty. Seed matching uses `catalog_key` first, then case-insensitive `article_name` among active key-less rows (`MIN(id)`), never the name+brand unique index as identity.

5. **Merge:** fill empty only; empty seed does not clear; no overwrite; no delete of missing keys; no second row for same key or same catalog product name; insert miss as `publication_status = draft` with no prices. A draft cannot be added to a price list until it is published. An existing price-list link stays.

6. **Dedicated seed service + CLI**, not `importItems` / not raising `MAX_IMPORT_ITEMS`. Run after Clubdesk enable (best-effort) and re-runnable for existing tenants. Local first.

7. **Surfaces:** picker shows name, brand, category, package size; full product facts on inventory article; seed `source` → `catalog_source`, plus `verified_at` / `data_status` quiet admin only. Public catalog remains published + non-archived only. The public article page lists product facts (category, pack, GTIN, ingredients, nutrition, prices). Variant stock writes and the internal note (`comment`) require the staff cookie — see [`CLUBDESK_KIOSK_STAFF_GATE.md`](CLUBDESK_KIOSK_STAFF_GATE.md). Purchase price and catalog provenance stay off the page. List and detail JSON still omit `comment`.

8. **Inventory `category` ≠ price-list category.**

## Verified implementation (2026-09-30)

| Item                                                            | Location                                                                                                                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed JSON (355 rows, 14 categories; each row has `catalog_key`) | `plugins/clubdesk/seeds/kiosk_master_catalog_sverige_berikad_verifierad.json`                                                                                             |
| Merge / match logic                                             | `plugins/clubdesk/services/kioskCatalogSeed.js`, `kioskCatalogSeedLogic.js`                                                                                               |
| Tenant connection + run                                         | `plugins/clubdesk/services/kioskCatalogSeedRunner.js` (`resolveTenantConnection`; local `TENANT_PROVIDER=local` uses `DATABASE_URL` + `tenant_{ownerUserId}` search_path) |
| Re-seed CLI                                                     | `scripts/seed-clubdesk-kiosk-catalog.js` → `npm run seed:clubdesk-kiosk-catalog` (`--email=` or `--tenant-id=`; all Clubdesk-enabled tenants when omitted)                |
| Best-effort on enable                                           | `plugins/tenants/model.js` (tenant plugin toggle), `scripts/set-tenant-plugin-access.js` when `clubdesk` is in `--enable`                                                 |
| Tenant migration                                                | `179-clubdesk-inventory-kiosk-catalog.sql` via `npm run migrate:clubdesk` (`scripts/run-clubdesk-migration.js`)                                                           |

**Match order (code):** `catalog_key` lookup (any row with that key, including archived) → else active rows with same `article_name` (skip if another active row owns a different non-empty key; name fallback = lowest `id` among active key-less rows) → else insert draft.

## Security (accepted residuals — Security Approved 2026-09-30, kiosk catalog only)

| ID       | Severity | Notes                                                                                                                                 |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Kiosk-S1 | Low      | `resolveTenantConnection` does not assert owner matches tenant; enable hook and CLI pass a consistent `ownerUserId` / `tenantId` pair |
| Kiosk-S2 | Low      | Local `SET search_path TO tenant_{id}` is unquoted; safe while owner id is numeric                                                    |
| Kiosk-S3 | Low      | A set `catalog_key` can be cleared to empty via admin API and then replaced (unique index applies only where key non-empty)           |
| Kiosk-S4 | Low      | New catalog text fields (e.g. `ingredients`, `allergens`) are not max-length limited on the inventory create/update route             |
| Kiosk-S5 | Low      | `featuredImageUrl` has no scheme allowlist (same class as existing Clubdesk inventory images; INV-S7)                                 |

## Consequences

- Enable path gains a tenant-DB side effect; operators need a re-seed CLI when the JSON is enriched.
- Item GTIN coexists with variant GTIN; product docs must distinguish them.
- Draft seed catalog is admin- and picker-visible, not public until published.
