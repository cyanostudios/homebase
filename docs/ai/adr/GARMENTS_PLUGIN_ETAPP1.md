# ADR: Garments plugin (Kläder) — Etapp 1

**Status:** Accepted (Grind 2 / Solution Architect) — Etapp 1 implemented locally  
**Date:** 2026-08-14  
**Context:** New Sport plugin for clothing size lists (shareable read-only) and a separate inventory surface. Grind 1 scope approved: plugin id `garments`, nav category Sport, two surfaces via `contentView` (Lists primary, Inventory secondary). Out of scope for later etapps: leader login, editable public links, stock decrement on handout, Excel import, contacts link, public SEO companion. **Local first only — no prod release** in this etapp.

## Decision

1. **Admin plugin `garments`** — Homebase plugin with `routeBase` `/api/garments`, CSRF on mutating routes, `requirePlugin('garments')`. Frontend registry route `/garments`, navigation `category: 'Sport'`, display name Kläder. Scaffold from [`templates/plugin-backend-template`](../../../templates/plugin-backend-template/) and [`templates/plugin-frontend-template`](../../../templates/plugin-frontend-template/) per [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](../../NEW_PLUGIN_INTEGRATION_CHECKLIST.md).

2. **Two surfaces, one plugin (`contentView`)** — Provider state `garmentsContentView`: `'lists' | 'inventory' | 'settings'` (default `'lists'`). Same pattern as matches `matchesContentView`. **Not** Clubdesk submenu routing. Dual panel state (garment list vs inventory item) inside one Provider.

3. **Lists schema (tenant DB, migration 131)** — Tables:
   - `garment_lists` — `user_id`, `name`, optional `team_id` → `teams(id) ON DELETE SET NULL`, `checkbox_columns JSONB` (array of `{ id, label, sort_order }`), timestamps.
   - `garment_list_persons` — free-text `name`, optional `contact_id` → `contacts(id)` ON DELETE SET NULL (migration **143**; set when importing From Contacts), `shirt_size` / `shorts_size` / `socks_size`, `jersey_number`, `jersey_name`, `initials`, `comment`, `checkbox_values JSONB` map `{ [columnId]: boolean }`, `sort_order`, FK `list_id` CASCADE.
   - `garment_list_shares` — mirror [`067-note-shares.sql`](../../../server/migrations/067-note-shares.sql).

4. **Checkbox columns = JSONB** — Admin-defined columns on the list; person booleans keyed by column `id`. On column remove, backend strips keys from all persons in one transaction. Default Excel-inspired template on new list is a **UX decision** (frontend sends default `checkbox_columns` on create).

5. **Inventory schema (tenant DB, same migration 131)** — Table `garment_inventory_items`: `user_id`, `article_name`, `brand`, `size`, `quantity` (≥ 0), `comment`. **Unique** on `(user_id, lower(article_name), lower(brand), lower(size))` with empty brand/size as `''`. **No** automatic FK or sync to lists.

6. **Team gating** — `team_id` optional. UI team picker and TeamView section only when teams plugin enabled. API may filter `GET /lists?team_id=`.

7. **Share (Notes-style, view-only v1)** — Create share writes `garment_list_shares` then `registerPublicShareRoute(token, 'garment_list', tenantConnectionString)`; fail closed. Public `GET /api/garments/public/:token`. Frontend `PublicGarmentListView` at `/public/garment-list/:token`. No public edit in Etapp 1.

8. **`public_share_routing` resource type** — String **`garment_list`**. Extend [`publicShareRouting.js`](../../../server/core/services/publicShareRouting.js). Migration **133** (`MAIN_DB_ONLY`) updates CHECK on `resource_type`.

9. **Plugin access (main DB, migration 132)** — `132-grant-garments-plugin-access.sql` marked **`MAIN_DB_ONLY`**. Alternative: `npm run set:tenant-plugins -- --enable=garments`. After access changes: **log out/in**. Local only unless user explicitly requests release/parity `--both`.

10. **TeamView integration** — Optional section/tab when garments enabled, following TeamRequestsSection / TeamMatchesSection.

11. **API surface** — Under `/api/garments`: CRUD `/lists`, nested `/lists/:id/persons`, shares, public `GET /public/:token`, CRUD `/inventory`.

12. **Migrations** —
    - `131-garments.sql` — tenant schema
    - `132-grant-garments-plugin-access.sql` — **MAIN_DB_ONLY**
    - `133-public-share-routing-garment-list.sql` — **MAIN_DB_ONLY**

## Out of scope (Etapp 1 / deferred)

- Leader login / role-specific public access
- Editable public share links
- Stock decrement / handout linkage
- Public SEO companion
- Production deploy without explicit release decision

## Later additions (post–etapp 1)

- CSV/Excel / Contacts import for person names (`contact_id` when From Contacts)
- Contacts **Linked** tiles for garment lists (`GET /garments/lists/for-contact/:contactId`)

## Configuration (local)

| Item             | Value                                             |
| ---------------- | ------------------------------------------------- |
| Plugin id        | `garments`                                        |
| Enable           | `npm run set:tenant-plugins -- --enable=garments` |
| Migrate          | Tenant `131`; main `132` + `133`                  |
| Public URL shape | `/public/garment-list/:token`                     |
| Resource type    | `garment_list`                                    |

## Security (residuals — for Security Expert)

- Public surface is **unauthenticated read-only** by opaque token + expiry, same residual class as Notes public shares.
- Token entropy and revoke path must match Notes.
- No SEO public companion in this etapp.

## Consequences

- Operators enable garments locally via migrations + plugin access, then log out/in.
- Lists and inventory are independent; no auto stock updates.
- Widening `public_share_routing` CHECK is required for share create.
- Further product work needs a later etapp / ADR delta.

## Person row UX (verified 2026-08-17)

Not a schema change. List detail and public share render each person as a **two-row block** (`PersonBlock` / `PersonMatrix`): identity (name, jersey badge, comment on admin) then sizes + wrapping labeled checkboxes. Public: `readOnly` + `hideComment`. Replaces the earlier wide HTML table in the same detail card. Security residual class unchanged — see [`GARMENTS_PUBLIC_SHARE_ETAPP1.md`](../security/GARMENTS_PUBLIC_SHARE_ETAPP1.md).

## References

- Templates, Notes share, `publicShareRouting.js`, tasks `team_id`, matches contentView
- Prior ADR: [`INSTRUCTIONS_PLUGIN_ETAPP1.md`](INSTRUCTIONS_PLUGIN_ETAPP1.md)
- Checklist: [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](../../NEW_PLUGIN_INTEGRATION_CHECKLIST.md)
