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

| View          | URL                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Lists**     | `/garments`           | Clothing checklists: persons + spreadsheet (Betalt & Blankett Fogis per person; Beställt/Levererat/Utdelat per Shorts/Tröja/Strumpor); optional team link                                                                                                                                                                                                                                                                                                      |
| **Inventory** | `/garments/inventory` | Stock **articles** with product fields (name required; optional brand, description, material, purchase price). Each article has **variants** (color and/or size + SKU + quantity) via a form repeater. Desktop: sticky quick-context (variant list with inline qty) + full view. Full view: platform prev/next when more than one article; closing the panel returns to `/garments/inventory`. Quick Actions include **Duplicate**. Not linked to lists in v1. |
| **Settings**  | (in-plugin overlay)   | List layout (cards/table, column count)                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Inventory uniqueness and copy behaviour

- **Color + size:** unique per article (case-insensitive). Enforced in client validation, model assert, and DB index `idx_garment_inventory_variants_unique`.
- **Article number (SKU):** unique per article when non-empty (case-insensitive). Empty SKUs may repeat. Enforced in client validation, model assert, and DB index `idx_garment_inventory_variants_sku_unique` (migration **`138`**).
- **Quantity PATCH** (`PATCH /inventory/:id/variants/:variantId/quantity`) updates quantity only; it does **not** re-run uniqueness checks (avoids blocking +/- on legacy rows with duplicate SKUs).
- **Duplicate article:** copies variants’ color/size/qty; **clears all SKUs** on the copy.
- **Duplicate variant row (form):** clears **SKU and size** (keeps color) so the new row is immediately saveable.
- Closing inventory create/edit/view navigates to **`/garments/inventory`**, not `/garments`.
- Leaving an open **list** via the sidebar (Inventory or another plugin) navigates in **one click**. Panel close does not bounce back to the lists index.

### Migrations (inventory)

| File                                                | Effect                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `137-garment-inventory-variants.sql`                | Child table `garment_inventory_variants`; truncates inventory test data                                     |
| `138-garment-inventory-variant-sku-unique.sql`      | Partial unique index on non-empty `sku` per `item_id`                                                       |
| `139-garments-grouped-checkbox-columns.sql`         | Resets all list `checkbox_columns` to an earlier 15-column grouped template                                 |
| `140-garments-person-level-checkbox-columns.sql`    | Resets to 11 columns: Betalt + Blankett Fogis (person) + Beställt/Levererat/Utdelat × Shorts/Tröja/Strumpor |
| `141-garment-list-persons-jersey-name-initials.sql` | Adds `jersey_name` + `initials` on `garment_list_persons`                                                   |
| `142-garments-checkbox-columns-english-labels.sql`  | Sets English labels/groups on all list checkbox columns                                                     |
| `143-garment-list-persons-contact-id.sql`           | Adds nullable `contact_id` on `garment_list_persons` (Contacts link)                                        |

Run: `npm run migrate:garments`. Apply **`138` in the target environment** before relying on DB-level SKU uniqueness (app validation alone is not enough for concurrent writers). Apply **`140`** so existing lists get the current spreadsheet column set.

## Person rows (list detail)

Admin list full view uses a **Notes-style** layout: list name + persons spreadsheet in the main card; Quick Actions and Information (incl. team) in the sidebar.

The persons matrix is a **spreadsheet table** with a single header row:

| Namn | Namn på tröja | Initialer | Betalt | Blankett Fogis | Beställt | Levererat | Utdelat |

_(UI working language is English: Name / Name on jersey / Initials / Paid / Fogis form / Ordered / Delivered / Handed out. Swedish remains in `sv.json`.)_

Each person is a **collapsible** parent row (jersey name, initials, Paid / Fogis on the person). Expanding shows child rows for **Shorts / Shirt / Socks** under the name, sharing the Ordered / Delivered / Handed out columns.

Checkboxes toggle immediately; name is editable via the row edit control. New persons are added below the table.

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

Public person blocks keep the older **two-row** `PersonBlock` layout, **read-only** (no Edit/Delete; checkboxes disabled). **Comments are hidden** (API clears `comment`; UI does not show the field).

## Teams

When both `teams` and `garments` are enabled, Team detail has a **Kläder** tab listing lists for that team.

## Requests → list intake (cross-plugin)

Requests can link a request type to a **garment list** and an intake field allowlist. Public `/public/request` collects `extra_data`; staff **Send to list** creates a `garment_list_person` via the requests plugin adapter (no auto-routing). Migration **`144`** on the requests table; runner `npm run migrate:requests-plugin-routing`.

Operator detail: [`REQUESTS_PLUGIN.md`](REQUESTS_PLUGIN.md). ADR: [`docs/ai/adr/REQUEST_PLUGIN_ROUTING.md`](ai/adr/REQUEST_PLUGIN_ROUTING.md).

## Security residuals

Unauthenticated share links can expose youth names, sizes, jersey numbers, and checkbox status. Same residual class as Notes public shares. See [`docs/ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md`](ai/security/GARMENTS_PUBLIC_SHARE_ETAPP1.md). Prefer short expiry and revoke after use. **Local first; no prod** without an explicit release.

**Inventory (Gate 5, 2026-08-23):** No unacceptable risks. Hardening note (non-blocking): nested `variants[]` on item POST/PUT is validated mainly as an array (max 100); dedicated `/variants` routes use per-field length/int rules. Prefer aligning nested validators with `variantBody` in a follow-up. Ensure migration **`138`** is applied in each target tenant DB before production use of SKU uniqueness.

## ADR

[`docs/ai/adr/GARMENTS_PLUGIN_ETAPP1.md`](ai/adr/GARMENTS_PLUGIN_ETAPP1.md)
