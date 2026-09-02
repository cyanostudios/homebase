# Garments (Kläder) — operator notes

Plugin id: **`garments`**. Sport nav label: **Kläder**.

## Enable (local)

```bash
npm run migrate:garments
# or grant only after schema exists:
npm run set:tenant-plugins -- --enable=garments
```

Then **log out and log in** so `/api/auth/me` refreshes `user.plugins`.

Production / `--both` only when you explicitly request release (Release Discipline).

## Surfaces

Sidebar submenu (Clubdesk-style), URL-driven:

| View          | URL                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lists**     | `/garments`           | Clothing checklists: persons + spreadsheet (Paid by default on new lists; optional **custom** person-level checkbox columns; Ordered/Delivered/Handed out per **assigned** inventory article). List index: cards/table layout toggle + column count (user settings key `garments`). **Settings** (gear): per-list person-matrix identity + checkbox columns (see **Person rows**). Optional **list** team link (form). Person matrix: configurable identity columns (name required; team when teams plugin enabled; jersey name / initials / number) plus Paid/custom checkboxes. Inventory groups filtered to assigned articles only (legacy Shorts/Shirt/Socks and Blankett Fogis hidden).                                                                                                                                    |
| **Inventory** | `/garments/inventory` | Stock **articles** with product fields (name required; optional brand, description, material, purchase/recommended/sale price, **tags**). Each article has **variants** (optional audience + color and/or size + SKU + quantity) via a form repeater. Desktop: sticky quick-context (variant list with inline qty, tags, assigned-list badges) + full view. Full view: **50/50** layout (`lg:grid-cols-2`) — details + **Show in lists** card beside variants; platform prev/next when more than one article. Assign articles to lists per item (see **Inventory ↔ lists**). List: tag filter chips; bulk **Tags** and **List visibility** via selection. **Settings** (gear): tag **catalog**, inventory **table columns** (incl. optional Tags column, default hidden), + CSV/Excel/paste import (see **Import inventory**). |

### Inventory uniqueness and copy behaviour

- **Audience + color + size:** may repeat. Non-blocking UI warning + red borders when two or more rows share the same triad (migration **`152`** drops the unique index from **`149`**).
- **Article number (SKU):** may repeat. Non-blocking UI warning + red borders when two or more rows share the same non-empty art.nr (migration **`150`**).
- **Quantity PATCH** (`PATCH /inventory/:id/variants/:variantId/quantity`) updates quantity only.
- **Duplicate article:** copies variants’ audience/color/size/qty; **clears all SKUs** on the copy.
- **Duplicate variant row (form):** copies audience/color/size; **clears SKU and quantity** (qty → 0).
- Closing inventory create/edit/view navigates to **`/garments/inventory`**, not `/garments`.
- Leaving an open **list** via the sidebar (Inventory or another plugin) navigates in **one click**. Panel close does not bounce back to the lists index.
- **Settings** is surface-scoped (`garmentsContentView: 'settings'` while URL stays on Lists or Inventory). Sidebar switch Lists ↔ Inventory **exits** settings and shows that surface’s list index — it does **not** open the other surface’s settings.

### Migrations (inventory)

| File                                                   | Effect                                                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `137-garment-inventory-variants.sql`                   | Child table `garment_inventory_variants`; truncates inventory test data                                     |
| `138-garment-inventory-variant-sku-unique.sql`         | Partial unique index on non-empty `sku` per `item_id`                                                       |
| `139-garments-grouped-checkbox-columns.sql`            | Resets all list `checkbox_columns` to an earlier 15-column grouped template                                 |
| `140-garments-person-level-checkbox-columns.sql`       | Resets to 11 columns: Betalt + Blankett Fogis (person) + Beställt/Levererat/Utdelat × Shorts/Tröja/Strumpor |
| `141-garment-list-persons-jersey-name-initials.sql`    | Adds `jersey_name` + `initials` on `garment_list_persons`                                                   |
| `142-garments-checkbox-columns-english-labels.sql`     | Sets English labels/groups on all list checkbox columns                                                     |
| `143-garment-list-persons-contact-id.sql`              | Adds nullable `contact_id` on `garment_list_persons` (Contacts link)                                        |
| `149-garment-inventory-variant-audience.sql`           | Adds `audience` on variants; unique index becomes `(item_id, audience, color, size)`                        |
| `150-garment-inventory-variant-sku-nonunique.sql`      | Drops SKU unique index so art.nr may repeat per item                                                        |
| `151-garment-inventory-recommended-sale-price.sql`     | Adds nullable `recommended_price` + `sale_price` on inventory items                                         |
| `152-garment-inventory-variant-identity-nonunique.sql` | Drops unique index on `(audience, color, size)` so identity may repeat                                      |
| `153-garment-list-inventory.sql`                       | Join table `garment_list_inventory_items`; `ct_sizes` JSONB on `garment_list_persons`                       |
| `154-garment-list-persons-ct-audiences.sql`            | `ct_audiences` JSONB on `garment_list_persons` (per-person audience per assigned inventory item)            |
| `155-garment-list-persons-team-id.sql`                 | Nullable `team_id` on `garment_list_persons` (optional per-person team; `ON DELETE SET NULL`)               |
| `156-garment-inventory-tags.sql`                       | `tags JSONB NOT NULL DEFAULT '[]'` on `garment_inventory_items`                                             |

Run: `npm run migrate:garments`. Apply **`149`–`156` in the target environment** as needed. Apply **`140`** so existing lists get the current spreadsheet column set.

## Inventory ↔ lists (per article)

From an inventory article **full view** or **edit form**, use the **Show in lists** card (`InventoryListAssignmentCheckboxes`) to assign the article to one or more garment lists. From the inventory **list**, select rows and use bulk **Tags** (`InventoryBulkTagsDialog`) and/or bulk **List visibility** (`InventoryBulkListsDialog`). Quick context shows tags (when present) and assigned list names as badges (assigned lists block is hidden when the article is on no lists).

Each assignment:

1. Inserts a row in `garment_list_inventory_items` (`list_id`, `item_id`, `sort_order`).
2. Appends three checkbox columns to the list’s `checkbox_columns` JSON (if not already present):

   | Column id pattern         | Label (English) | Group        |
   | ------------------------- | --------------- | ------------ |
   | `inv_{itemId}_ordered`    | Ordered         | article name |
   | `inv_{itemId}_delivered`  | Delivered       | article name |
   | `inv_{itemId}_handed_out` | Handed out      | article name |

3. Exposes a **size** field per person per assigned article in the persons matrix (see below).

**Unassign** (checkbox off on the article or bulk unassign): blocked with **409** if any person on that list has a checked box for that article’s three columns. On success, removes the join row, strips the three column ids from `checkbox_columns`, and clears matching keys from each person’s `checkbox_values`, `ct_sizes`, and `ct_audiences`.

The client applies **optimistic** assignment updates (`GarmentProvider.patchInventoryListAssignment`); failed unassign rolls back. Single-item inventory GET responses include `assignedListIds` via server-side enrichment (`enrichInventoryWithAssignments`).

**Delete inventory article**: removes list assignments first (force-unassign: strips that article’s Ordered/Delivered/Handed out columns and per-person size/audience keys), then deletes the item. Confirm dialog warns when the article is shown on lists.

### API (list ↔ inventory)

All routes require garments plugin access + CSRF on mutations. List and inventory ownership enforced via `user_id` on parent rows.

| Method   | Path                                                 | Body / notes                                                                                                                                                                                                             |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST`   | `/api/garments/lists/:id/inventory-items/:itemId`    | Assign article to list; returns updated list                                                                                                                                                                             |
| `DELETE` | `/api/garments/lists/:id/inventory-items/:itemId`    | Unassign; 409 if checked in list                                                                                                                                                                                         |
| `PATCH`  | `/api/garments/lists/:id/persons/:personId/ct-sizes` | `{ "ctSizes": { "<itemId>": "M" }, "ctAudiences": { "<itemId>": "Men" } }` — partial merge; only keys for articles assigned to the list are applied. Values trimmed to 50 chars (`ctSizes`) / 100 chars (`ctAudiences`). |

Lists and inventory items in API responses include `assignedInventoryItemIds` / `assignedListIds` respectively.

## Inventory tags (Contacts-style)

**Catalog** (user settings key `garments`, field `tags`): managed under Inventory **Settings → Tags** (`GarmentsInventorySettingsView`). Normalized with `normalizeInventoryTags` (trim, drop empties, case-insensitive dedupe, max **50** tags × **100** chars).

**Per article:** `garment_inventory_items.tags` JSONB (migration **`156`**). Assign from create/edit form (catalog checkboxes). Shown on full view, quick context, and optional table column `tags` (default **hidden** in `inventoryTableColumns`).

**List filter:** chips **All** + one chip per catalog tag with counts (`inventoryItemMatchesTagFilter` / `GarmentList`). Search also matches tag strings.

**Bulk Tags** (selection mode → **Tags**): add one catalog tag to each selected article (existing tags kept) or **Clear tags**. Provider: `applyTagToInventoryItem` / `clearTagsFromInventoryItem` → existing `PUT /api/garments/inventory/:id` with full inventory payload (`buildInventoryTagsSavePayload`).

**API:** `tags` optional on create/update inventory body — array max 50; each string max 100; server `normalizeInventoryTags`. Mutations: garments plugin gate + CSRF.

**Residual (Security R-INV-BULK-1, low):** tag-only bulk uses full inventory PUT including variants + sequential requests — same class as Contacts bulk tags. No separate TPM gate.

## Person rows (list detail)

Admin list full view uses a **Notes-style** layout: list name + persons spreadsheet in the main card; Quick Actions and Information (incl. team) in the sidebar.

The persons matrix is a **spreadsheet table**. Default visible identity columns (admin):

| Name _(required)_ | Team _(teams plugin)_ | Name on jersey | Initials | No. | Paid _(default on new lists)_ | _(custom person checkboxes)_ | _(per assigned article)_ Audience · Size · Ordered · Delivered · Handed out |

_(UI working language is English; Swedish in `sv.json`. Column **visibility and order** for identity fields are per-user under `garments.personMatrixIdentityByList[listId]`. Team is omitted when the teams plugin is disabled. Paid and custom checkboxes live in list `checkbox_columns`; inventory status columns come from assigned articles.)_

Person create/update (`POST` / `PUT` `/api/garments/lists/:id/persons[/:personId]`) accept optional `teamId` (numeric id or `null`), same validation style as `contactId`. CSRF + garments plugin gate required. List ownership is enforced before write (`user_id` on the parent list).

Each person is a **collapsible** parent row (visible identity columns + person-level checkboxes). Expanding shows **child rows per assigned inventory article** only (`filterMatrixColumns` — legacy Shorts/Shirt/Socks groups and Blankett Fogis are not shown; columns with `hidden: true` are omitted). On phone/pad the matrix scrolls horizontally (`MATRIX_TABLE_SCROLL_CLASS`); the name column is not sticky.

**Person matrix column settings** (`GarmentsListsSettingsView`, gear on `/garments`):

- Pick a garment list, then edit **Identity columns** (`TableColumnsSettingsSection`: name always visible; team / jersey name / initials / number default on, hideable + reorderable) and **Person columns** (Paid + `custom_<uuid>`: hide, delete, reorder, add; **Add Paid** restores Paid if removed).
- **Paid** is included by default on **new** lists (`createDefaultCheckboxColumns`) and may be deleted from an existing list.
- Checkbox changes: `PUT /lists/:id` with the **full** `checkboxColumns` array (preserve `inv_*` / legacy / Fogis). Identity changes: user settings `personMatrixIdentityByList` (load must succeed before identity persist; checkbox save is independent if identity prefs are still loading). Cap: **50** checkbox columns total (API).
- Helpers: `customCheckboxColumns.ts`, `personMatrixIdentityColumns.ts`. UI: `GarmentListCustomColumnsSettingsSection`.

**Status / Paid checkboxes (non-edit):** boxes flip **optimistically** via `GarmentProvider.patchPersonLocal` before the network returns. Saves use a per-person **serial latest-wins** queue (`createSerialLatestQueue` in `client/src/core/utils/serialLatestQueue.ts`) with generation tokens so rapid clicks do not lose updates. Failed saves roll back only when that generation is still current and show `garments.saveFailed` (`role="status"`). Edit-mode rows keep draft + awaited `updatePerson`. Platform guideline: [`CLIENT_OPTIMISTIC_UI.md`](./CLIENT_OPTIMISTIC_UI.md). Name is editable via the row edit control. New persons are added below the table.

Below the spreadsheet (admin and public share), a **size summary** (`buildGarmentListFitSummary` / `GarmentListFitSummary`) lists each assigned inventory article with: filled count (persons with size and/or audience), audience histogram, and size histogram. Status checkboxes (Ordered/Delivered/Handed out) are **not** included in the counts.

### Per-person audience and size (assigned inventory)

For child rows whose checkbox group maps to an assigned inventory article (`inv_{itemId}_*` column ids):

- **Audience:** if the article’s variants define one or more distinct **audience** values → dropdown per person (stored in `garment_list_persons.ct_audiences`, keyed by inventory item id); otherwise free-text input.
- **Size:** if the article’s variants define one or more **size** values → dropdown per person (stored in `garment_list_persons.ct_sizes`, keyed by inventory item id); otherwise free-text input.
- Updates via `PATCH …/ct-sizes` with optional `ctSizes` and/or `ctAudiences` (partial merge; only assigned item ids accepted server-side).

Legacy size columns (`shirt_size`, `shorts_size`, `socks_size`) remain on the person model for older layouts; inventory-linked sizes use `ct_sizes` / `ct_audiences` only.

### Import persons (names only)

From list full view → **Quick actions → Import names**:

1. **File or paste** — platform `ImportWizard` (CSV / Excel / paste), required column `name` (no contact link)
2. **From Contacts** — pick a Contacts tag/group; imports matching contacts’ display names (`companyName`) and stores `contact_id` so the contact shows the list under **Linked**

Other person fields stay empty for later edit.

### Import inventory (CSV / Excel / paste)

From **Inventory** → **Settings** (gear icon on desktop list header; mobile via list `onSettings`):

1. **Download CSV template** — two example rows show variant grouping (same article + brand, different audience/color/size/SKU/qty). Implemented in `GarmentsInventorySettingsView` via `downloadImportCsvTemplate({ exampleRows })`.
2. **Import** — platform `ImportWizard` (CSV, Excel `.xlsx`, or pasted table). One **row per variant**; rows with the same article name and brand merge into one inventory item with multiple variants (`groupInventoryImportRows.ts`).
3. Persisted via existing `POST /api/garments/inventory` (create-only; duplicate article+brand returns **409** and counts as failed in the wizard result). List assignment is **not** part of import — use **Show in lists** after import.

**Entry points (code):**

| Del                           | Sökväg                                                                     |
| ----------------------------- | -------------------------------------------------------------------------- |
| Settings UI                   | `client/src/plugins/garments/components/GarmentsInventorySettingsView.tsx` |
| Import schema + template rows | `client/src/plugins/garments/utils/inventoryImportSchema.ts`               |
| Flat row → grouped payloads   | `client/src/plugins/garments/utils/groupInventoryImportRows.ts`            |
| Failure breakdown messages    | `client/src/plugins/garments/utils/inventoryImportFailures.ts`             |
| Provider handler              | `GarmentProvider.importInventoryItems`                                     |

**Template columns (English labels; SV/EN aliases for auto-mapping):** Article _(required)_, Brand, Description, Material, Purchase Price, Recommended Price, Sale Price, Currency, Comment, Article no., Audience, Color, Size, Quantity.

**Parsing (core `importUtils`):** Comma, semicolon (typical Swedish Excel export), or tab delimiter; BOM stripped from headers; short rows padded to header width. Soft limits: 5 MB file / max 2000 data rows (ADR).

**Result step:** `{ successCount, failureCount, failureMessages? }` — breakdown distinguishes empty Article cells, unmapped column, validation, duplicate (409), and API errors (i18n keys `garments.importFailure*`).

**Begränsningar:**

- Max **100 variants** per item on `POST /inventory` (server `variants` array max); grouping many rows into one article fails validation if >100 variants.
- Create-only — no upsert; existing article+brand → 409.
- Client-side file parse only; data sent as JSON POST (same security class as contacts import).

Column labels in the template are English (platform convention for auto-mapping). Required field: **Article** (`articleName`).

### Contacts ↔ list link

- `garment_list_persons.contact_id` → `contacts(id)` ON DELETE SET NULL (migration **`143`**)
- Contacts detail / quick context **Linked** tiles include garment lists when a person row references that contact
- Open navigates to the list via Garments provider

Duplicate jersey numbers on the same list still show a non-blocking warning when the jersey **number** column is in use.

## Sharing

Notes-style view-only link. Creates `garment_list_shares` + main-DB `public_share_routing` (`resource_type = garment_list`). Public page: `/public/garment-list/:token`.

Public share uses the same **spreadsheet** layout as admin for core fields (name / jersey name / initials + non-hidden person-level checkboxes including Paid/custom when present + inventory status columns). **Per-user identity prefs do not apply** on the public page (name / jersey name / initials stay visible; Team column is not rendered). Columns with `hidden: true` on the list are omitted. Per person, **only inventory articles with filled data** are shown as child rows (size, audience, or any Ordered/Delivered/Handed out checked). Empty assigned articles are hidden. **Comments are hidden** (API clears `comment`). Public payload includes `assignedInventoryItemIds`, `ct_sizes`, `ct_audiences`, and optional numeric person `teamId`. The same **size summary** as admin appears under the public matrix (aggregates from person size/audience only).

## Teams

When both `teams` and `garments` are enabled:

- **List form:** optional `team_id` on `garment_lists` (list ↔ team).
- **Person matrix:** optional per-person `team_id` on `garment_list_persons` (migration **`155`**). Shown when the teams plugin is enabled and the column is visible in that user’s identity prefs (default on). Value may be empty (`—` / “No team”).
- **Team detail:** **Kläder** tab lists garment lists for that team (list-level `team_id`).

## Requests → list intake (cross-plugin)

Requests can link a request type to a **garment list** and an intake field allowlist. Public `/public/request` collects `extra_data`; staff **Send to list** creates a `garment_list_person` via the requests plugin adapter (no auto-routing). Migration **`144`** on the requests table; runner `npm run migrate:requests-plugin-routing`.

Operator detail: [`REQUESTS_PLUGIN.md`](REQUESTS_PLUGIN.md). ADR: [`docs/ai/adr/REQUEST_PLUGIN_ROUTING.md`](ai/adr/REQUEST_PLUGIN_ROUTING.md).

## Security residuals

Unauthenticated share links can expose youth names, sizes, jersey numbers, checkbox status (including **custom** person-level column labels/values when not `hidden`), inventory-linked size/audience fields, and (when set) numeric person **`teamId`**. Same residual class as Notes public shares. See [`docs/ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md`](ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md). Prefer short expiry and revoke after use. **Local first; no prod** without an explicit release.

**Inventory (Gate 5, 2026-08-23):** No unacceptable risks. Hardening note (non-blocking): nested `variants[]` on item POST/PUT is validated mainly as an array (max 100); dedicated `/variants` routes use per-field length/int rules. Prefer aligning nested validators with `variantBody` in a follow-up. Ensure migrations **`149`** and **`150`** are applied in each target tenant DB (audience uniqueness; art.nr non-unique).

**List ↔ inventory (Gate 5, 2026-08-28):** No unacceptable risks. `PATCH …/ct-sizes` trims `ctSizes` values to 50 chars and `ctAudiences` to 100 chars server-side.

**Person team (Gate 5, 2026-08-31):** No unacceptable risks. Optional person `teamId` on create/update: numeric-or-null validation, CSRF, plugin gate, list `user_id` ownership. FK to tenant `teams(id)`; invalid id may surface as DB error (same class as list-level `team_id`). Public share may include numeric `teamId` in person JSON (UI does not show Team on public `PersonBlock`). Non-blocking follow-up: map FK violations to 400.

**Size summary (Gate 5, 2026-08-31):** No unacceptable risks. Client-only aggregate of already-loaded `ct_sizes` / `ct_audiences`; no new API. Public share summary stays within the existing person-data exposure class.

**Inventory import (Gate 5, 2026-09-01):** No unacceptable risks. Settings → `ImportWizard` → sequential `POST /api/garments/inventory` with plugin gate + CSRF; server validates item fields and `variants` array (max 100). Client-side parse only (5 MB / 2000 rows). Same residual class as tabular import A1 (SheetJS) and pre-existing nested variant field-length gap on item POST (see inventory hardening note above). Create-only; duplicate article+brand → 409.

## ADR

[`docs/ai/adr/GARMENTS_PLUGIN_ETAPP1.md`](ai/adr/GARMENTS_PLUGIN_ETAPP1.md)
