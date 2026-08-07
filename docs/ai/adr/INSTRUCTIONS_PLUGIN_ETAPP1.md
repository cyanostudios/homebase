# ADR: Instructions plugin — Etapp 1

**Status:** Accepted (Etapp 1) + post-etapp UX delta + category catalog (2026-08-06) + form-owned categories (2026-08-07)  
**Date:** 2026-08-07  
**Context:** Admin CRUD for ordered instruction steps plus a public read-only surface, following the cups/guides public-app pattern. QA Approved + Security Approved for Etapp 1 baseline; residual security risks for Etapp 1 accepted by TPM. Post-etapp UX delta and **category catalog / sort order** (migration 117) documented after QA Approved + Security Approved for that delta. **Form-owned category catalog** (Settings View-only; delete with optional `moveToCategory`; click-to-assign on form) documented after QA Approved + Security Approved 2026-08-07. **Ej prod-release** in this etapp.

## Decision

1. **Admin plugin `instructions`** — Homebase plugin with `routeBase` `/api/instructions`, CSRF on mutating routes, `requirePlugin('instructions')`. Frontend registry route `/instructions` (list/form/view/settings).
2. **Schema (tenant DB, migration 114)** — Tables `instructions` and `instruction_steps` (ordered by `sequence_order`). Parent fields include title, slug (unique per `user_id`), description, featured image URL, category, `publication_status` ∈ `draft` | `published`. Slug uniqueness is enforced in DB (`idx_instructions_user_lower_slug`). **Title is not DB-unique**; uniqueness is application-layer only (see decision 7).
3. **Publish rule** — `published` requires at least one step (payload and/or existing DB rows). Enforced in the model (`assertPublishedHasSteps`).
4. **Plugin access (main DB, migration 115)** — Grant `instructions` in `tenant_plugin_access` / `user_plugin_access`, or enable via `npm run set:tenant-plugins -- --enable=instructions`. Runner: `npm run migrate:instructions` (114 + 116 + 117 tenant; 115 grant). After access changes: **log out/in**.
5. **Public companion (Node)** — `plugins/public-instructions/` at `/api/public/instructions` (list + get by slug/id). Unauthenticated, `publicEndpointLimiter`, reads **one** tenant via `PUBLIC_INSTRUCTIONS_USER_ID` or `PUBLIC_INSTRUCTIONS_USER_EMAIL`. Only `publication_status = 'published'`. List response may include `categoryOrder`. CORS includes `PUBLIC_INSTRUCTIONS_URL` when set.
6. **Public site (PHP)** — `public-instructions/` (Caddy + PHP-FPM pattern). Same-origin PHP APIs use tenant Postgres via **`APP_DB_URL`** (not Homebase main `DATABASE_URL`). List uses same-origin `/api/items.php` (`items` + `categoryOrder`). Local: `npm run dev:public-instructions` → port **3010**.
7. **Title uniqueness (app-layer)** — Create/update reject duplicate titles for the same user (case-insensitive). Backend: `assertTitleUnique` (update passes `excludeId`). Frontend: `hasDuplicateInstructionTitle` in validate. Conflict → HTTP 409 / field `title`. No unique index on `title`.
8. **Admin step ops beyond form edit** — Detail view can reorder steps (up/down) and copy a step via `reorderInstructionSteps` / `copyInstructionStep` (persisted update). Form uses the same pure helpers (`reorderSteps` / `copyStepAt`) for local edits. List cards show category badge; detail featured image preview is 300×300.
9. **Public UX (verified)** — No audio. Home list: instructions as two-column `item-grid` cards / Netflix rows grouped by category. Detail: sticky `step-subheader` (title, step title, “Steg X av Y” + bar); circular prev/next; last step control labeled “Klart” navigates to category listing; step media height `--step-media-h: 19rem`.
10. **Category catalog (tenant DB, migration 117)** — Table `instruction_categories` (`name`, `sort_order`) per `user_id`. **Form-owned catalog:** Instruction edit form card **Instruction category** (add / reorder / delete). Settings is **View only** (`InstructionSettingsTab = 'view'`) — no Categories settings tab. Assign this instruction’s `category` by clicking a category name on that card (click again → uncategorized); Information card has no category `Select`. List chips and public quick-nav/rows follow catalog order; orphan category strings after catalog; uncategorized/`Övrigt` last. Public list JOIN matches categories with `c.user_id = i.user_id`; `categoryOrder` is scoped to catalog owners that have published instructions.
11. **Category delete + reassignment** — `DELETE /api/instructions/categories/:id` accepts optional JSON `{ moveToCategory: string | null }`. If matching instructions exist and the key is **absent**, API returns **409**. Presence of `moveToCategory` (including `null`) reassigns then deletes the catalog row. Frontend sends options only after dialog confirm; empty category delete uses no body (same pattern as Clubdesk / price list).

## Out of scope (Etapp 1)

- Price list
- Messages
- Swish
- Guides HITL / content-production changes
- Production deploy (Railway / prod migration apply)
- DB unique constraint on `instructions.title` (explicitly not added; app-layer only)

## Configuration (verified)

| Variable                         | Where                              | Role                                        |
| -------------------------------- | ---------------------------------- | ------------------------------------------- |
| `PUBLIC_INSTRUCTIONS_USER_ID`    | Homebase `.env` / Railway          | Preferred numeric owner for public Node API |
| `PUBLIC_INSTRUCTIONS_USER_EMAIL` | Homebase                           | Fallback resolve on main DB                 |
| `PUBLIC_INSTRUCTIONS_URL`        | Homebase                           | Public origin for CORS allowlist            |
| `APP_DB_URL`                     | `public-instructions` site service | Tenant Neon for PHP read APIs               |

Documented in [`.env.example`](../../../.env.example) and [`public-instructions/railway.env.example`](../../../public-instructions/railway.env.example).

## Security (residual, TPM-accepted for Etapp 1)

Public surfaces are **unauthenticated read-only**, filtered to published rows for a single configured owner (Node) or published rows in the tenant DB wired by `APP_DB_URL` (PHP). List payloads may include **`categoryOrder`** (catalog name strings for ordering UI) in addition to per-item `category`. Same residual class as `public-cups` / `public-guides`. TPM accepted residual risks for Etapp 1; the category-catalog delta does not introduce a new residual class (Security Approved 2026-08-06). **Ej prod-release** in this etapp.

Admin category mutations (`/api/instructions/categories*`) remain behind auth, plugin gate, CSRF, and validation. Catalog delete with matching instructions requires intentional `moveToCategory` (409 otherwise). FE omits the key unless reassignment is confirmed (Security Approved 2026-08-07). `moveToCategory` may be any normalized string ≤100 chars or `null` (orphan / uncategorized allowed).

Title uniqueness is application-enforced only (race possible under concurrent writes without a DB unique index).

## Consequences

- Operators enable the plugin locally with `migrate:instructions` and/or `set:tenant-plugins`, then log out/in.
- Public Node API is inactive until `PUBLIC_INSTRUCTIONS_USER_ID` or `PUBLIC_INSTRUCTIONS_USER_EMAIL` is set.
- Public PHP site needs `APP_DB_URL` pointing at the tenant that holds instruction rows.
- Duplicate titles are blocked in normal admin flows; concurrent double-create can still race until a DB constraint is added in a later etapp (if desired).
- Category order and catalog CRUD are controlled on the Instruction form (**Instruction category** card); Settings only configures list View columns. Public and list chips consume catalog order via `categoryOrder` / join on `instruction_categories`.
- Further product work (commerce, messaging, Swish, Guides HITL, prod) requires a later etapp / explicit release decision.

## References

- Migrations: [`server/migrations/114-instructions.sql`](../../../server/migrations/114-instructions.sql), [`115-grant-instructions-plugin-access.sql`](../../../server/migrations/115-grant-instructions-plugin-access.sql), [`116-instructions-sort-order.sql`](../../../server/migrations/116-instructions-sort-order.sql), [`117-instruction-categories.sql`](../../../server/migrations/117-instruction-categories.sql), [`server/migrations/README.md`](../../../server/migrations/README.md)
- Admin: [`plugins/instructions/`](../../../plugins/instructions/), [`client/src/plugins/instructions/`](../../../client/src/plugins/instructions/)
- Public Node: [`plugins/public-instructions/`](../../../plugins/public-instructions/)
- Public site: [`public-instructions/`](../../../public-instructions/), [`public-instructions/README.md`](../../../public-instructions/README.md)
- Pattern docs: [`NEW_PLUGIN_INTEGRATION_CHECKLIST.md`](../../NEW_PLUGIN_INTEGRATION_CHECKLIST.md), [`PUBLIC_APP_TEMPLATE.md`](../../PUBLIC_APP_TEMPLATE.md)
