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

| View          | URL                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lists**     | `/garments`           | Clothing checklists: persons + spreadsheet (Paid per person; Ordered/Delivered/Handed out per **assigned** inventory article). List index: cards/table layout toggle + column count (persisted under user settings key `garments`). Optional **list** team link (form). Person matrix: optional **per-person** team column (after name, before jersey name) when the teams plugin is enabled. Person matrix shows only columns for inventory assigned to the list (legacy Shorts/Shirt/Socks groups and Blankett Fogis are hidden).                                                             |
| **Inventory** | `/garments/inventory` | Stock **articles** with product fields (name required; optional brand, description, material, purchase price). Each article has **variants** (optional audience + color and/or size + SKU + quantity) via a form repeater. Desktop: sticky quick-context (variant list with inline qty, assigned-list badges) + full view. Full view: **50/50** layout (`lg:grid-cols-2`) — details + **Show in lists** card beside variants; platform prev/next when more than one article. Assign articles to lists per item (see **Inventory ↔ lists**). Bulk assign/unassign via inventory list selection. |

### Inventory uniqueness and copy behaviour

- **Audience + color + size:** may repeat. Non-blocking UI warning + red borders when two or more rows share the same triad (migration **`152`** drops the unique index from **`149`**).
- **Article number (SKU):** may repeat. Non-blocking UI warning + red borders when two or more rows share the same non-empty art.nr (migration **`150`**).
- **Quantity PATCH** (`PATCH /inventory/:id/variants/:variantId/quantity`) updates quantity only.
- **Duplicate article:** copies variants’ audience/color/size/qty; **clears all SKUs** on the copy.
- **Duplicate variant row (form):** clears **SKU and size** (keeps audience and color).
- Closing inventory create/edit/view navigates to **`/garments/inventory`**, not `/garments`.
- Leaving an open **list** via the sidebar (Inventory or another plugin) navigates in **one click**. Panel close does not bounce back to the lists index.

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

Run: `npm run migrate:garments`. Apply **`149`–`155` in the target environment** as needed. Apply **`140`** so existing lists get the current spreadsheet column set.

## Inventory ↔ lists (per article)

From an inventory article **full view** or **edit form**, use the **Show in lists** card (`InventoryListAssignmentCheckboxes`) to assign the article to one or more garment lists. From the inventory **list**, select rows and use bulk **List visibility** (`InventoryBulkListsDialog`) to assign or unassign many articles to one list at a time. Quick context shows assigned list names as badges.

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

## Person rows (list detail)

Admin list full view uses a **Notes-style** layout: list name + persons spreadsheet in the main card; Quick Actions and Information (incl. team) in the sidebar.

The persons matrix is a **spreadsheet table** with a single header row:

| Namn | Lag _(when teams enabled)_ | Namn på tröja | Initialer | Betalt | _(per assigned article)_ Audience · Size · Beställt · Levererat · Utdelat |

_(UI working language is English: Name / Team / Name on jersey / Initials / Paid / Audience / Size / Ordered / Delivered / Handed out. Swedish remains in `sv.json`. Team column is omitted when the teams plugin is disabled.)_

Person create/update (`POST` / `PUT` `/api/garments/lists/:id/persons[/:personId]`) accept optional `teamId` (numeric id or `null`), same validation style as `contactId`. CSRF + garments plugin gate required. List ownership is enforced before write (`user_id` on the parent list).

Each person is a **collapsible** parent row (jersey name, initials, Paid on the person). Expanding shows **child rows per assigned inventory article** only (`filterMatrixColumns` — legacy Shorts/Shirt/Socks groups and Blankett Fogis are not shown). On phone/pad the matrix scrolls horizontally (`MATRIX_TABLE_SCROLL_CLASS`); the name column is not sticky.

Checkboxes toggle immediately; name is editable via the row edit control. New persons are added below the table.

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

### Contacts ↔ list link

- `garment_list_persons.contact_id` → `contacts(id)` ON DELETE SET NULL (migration **`143`**)
- Contacts detail / quick context **Linked** tiles include garment lists when a person row references that contact
- Open navigates to the list via Garments provider

Duplicate jersey numbers on the same list still show a non-blocking warning when relevant (jersey remains on the person model; not shown as a table column in this layout).

## Sharing

Notes-style view-only link. Creates `garment_list_shares` + main-DB `public_share_routing` (`resource_type = garment_list`). Public page: `/public/garment-list/:token`.

Public person blocks keep the older **two-row** `PersonBlock` layout, **read-only** (no Edit/Delete; checkboxes disabled). **Comments are hidden** (API clears `comment`; UI does not show the field). **`ct_sizes`**, **`ct_audiences`**, and optional person **`teamId`** (numeric id string, or null) are included in the public JSON payload (`getListByShareToken` strips `comment` only). The public `PersonBlock` UI does **not** render a Team column; exposure is metadata in the API response.

## Teams

When both `teams` and `garments` are enabled:

- **List form:** optional `team_id` on `garment_lists` (list ↔ team).
- **Person matrix:** optional per-person `team_id` on `garment_list_persons` (migration **`155`**). Column after name / before jersey name; value may be empty (`—` / “No team”).
- **Team detail:** **Kläder** tab lists garment lists for that team (list-level `team_id`).

## Requests → list intake (cross-plugin)

Requests can link a request type to a **garment list** and an intake field allowlist. Public `/public/request` collects `extra_data`; staff **Send to list** creates a `garment_list_person` via the requests plugin adapter (no auto-routing). Migration **`144`** on the requests table; runner `npm run migrate:requests-plugin-routing`.

Operator detail: [`REQUESTS_PLUGIN.md`](REQUESTS_PLUGIN.md). ADR: [`docs/ai/adr/REQUEST_PLUGIN_ROUTING.md`](ai/adr/REQUEST_PLUGIN_ROUTING.md).

## Security residuals

Unauthenticated share links can expose youth names, sizes, jersey numbers, checkbox status, inventory-linked size/audience fields, and (when set) numeric person **`teamId`**. Same residual class as Notes public shares. See [`docs/ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md`](ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md). Prefer short expiry and revoke after use. **Local first; no prod** without an explicit release.

**Inventory (Gate 5, 2026-08-23):** No unacceptable risks. Hardening note (non-blocking): nested `variants[]` on item POST/PUT is validated mainly as an array (max 100); dedicated `/variants` routes use per-field length/int rules. Prefer aligning nested validators with `variantBody` in a follow-up. Ensure migrations **`149`** and **`150`** are applied in each target tenant DB (audience uniqueness; art.nr non-unique).

**List ↔ inventory (Gate 5, 2026-08-28):** No unacceptable risks. `PATCH …/ct-sizes` trims `ctSizes` values to 50 chars and `ctAudiences` to 100 chars server-side.

**Person team (Gate 5, 2026-08-31):** No unacceptable risks. Optional person `teamId` on create/update: numeric-or-null validation, CSRF, plugin gate, list `user_id` ownership. FK to tenant `teams(id)`; invalid id may surface as DB error (same class as list-level `team_id`). Public share may include numeric `teamId` in person JSON (UI does not show Team on public `PersonBlock`). Non-blocking follow-up: map FK violations to 400.

## ADR

[`docs/ai/adr/GARMENTS_PLUGIN_ETAPP1.md`](ai/adr/GARMENTS_PLUGIN_ETAPP1.md)
