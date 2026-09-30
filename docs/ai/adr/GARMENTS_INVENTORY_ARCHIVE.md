# ADR: Garments inventory archive

**Status:** Accepted (Solution Architect)  
**Date:** 2026-09-29  
**Scope:** Garments inventory articles only. Not Clubdesk. No “replaced by” link. No production deploy in this decision.

**Related:** TPM scope for catalog changes that must not erase list, person, or statistics history. Existing delete force-unassigns and removes the row (`plugins/garments/model.js`). Person size/audience and fit-summary procurement are keyed by inventory item id, not by variant id.

## Context

Lists, person fit data, and order statistics point at `garment_inventory_items.id`. Hard delete today strips those traces and removes the row. Rename updates the same row, so a product swap done as a rename rewrites history. Variant rows are a current picklist; stored size/audience text is not a foreign key.

Uniqueness today is `(user_id, lower(article_name), lower(brand))` on all rows, so an archived article would block a new active article with the same name and brand.

## Decision

1. **Archive flag.** Add nullable `archived_at` on `garment_inventory_items`. `NULL` means active. Expose as `archivedAt` on inventory API payloads. Product create/update must ignore this field.

2. **Explicit archive and restore.** `POST /api/garments/inventory/:id/archive` sets `archived_at` if null (idempotent). `POST /api/garments/inventory/:id/restore` clears it. Restore that would violate the active unique key returns 409.

3. **Active uniqueness only.** Replace the item unique index with a partial unique index on `(user_id, lower(article_name), lower(brand)) WHERE archived_at IS NULL`. Several archived rows may share the same name and brand.

4. **Hard delete does not cascade history.** `DELETE` no longer force-unassigns. If the article is in use, return 409 and leave all rows. In use means any of: a `garment_list_inventory_items` row; a person `ct_sizes` or `ct_audiences` key for that item id; a person `checkbox_values` key `inv_{itemId}_*`; a `fit_summary_procurement` key for that item id. Otherwise delete the item (variants still cascade).

5. **No new assignment of archived articles.** `POST` assign returns 409 when `archived_at` is set. Existing joins stay. Duplicating a list copies existing joins, including archived articles. That copy is not a new assignment.

   **List duplicate is one server transaction**, not a loop of assign calls. `POST /api/garments/lists/:id/duplicate` with `{ "name": "<dialog name>" }` (required, trimmed, 1–255, same rule as create list). Plugin gate and CSRF match other list mutations. Source list must belong to the current user; otherwise 404.

   In one database transaction, insert a new list and copy from the source: `team_id`, `checkbox_columns` (verbatim, including existing `inv_*` columns), `fit_summary_procurement`, every `garment_list_inventory_items` row (`item_id` and `sort_order`, archived articles included), and every person row (new person ids; same `name`, sizes, jersey fields, `initials`, `comment`, `contact_id`, `team_id`, `checkbox_values`, `ct_sizes`, `ct_audiences`, `sort_order`). Do not copy shares. Do not call assign, and do not rebuild checkbox columns from the catalog. On any failure, commit nothing — the caller must not be left with a list that exists without its joins. Response is the same enriched list as `GET /api/garments/lists/:id`. The call is not idempotent; each post creates one new list. Assign’s 409 for a new placement of an archived article stays.

6. **Display name is the live article name.** No name snapshot. Lists, matrix group labels, and statistics resolve the label from the inventory row by id, including archived rows. The `group` string stored on checkbox columns at assign time is not the source of truth when the item still exists. Catalog context must keep archived items loaded so resolution does not fall back to a stale group label.

7. **Variants stay a current picklist.** Deleting or editing variants must not delete or rewrite person `ct_sizes` / `ct_audiences` or fit-summary procurement. New choices come from current variants. A stored size or audience that is no longer in the catalog remains stored and must still be shown. No variant-level archive in this decision.

8. **Unassign is unchanged.** Unassign still removes that list’s join and its person/procurement keys, and still 409s only when a status checkbox is checked. Archive is how catalog cleanup keeps history. Unassign is an intentional removal from one list.

## Consequences

- A product change for new orders is a new inventory row. The previous row is archived, not renamed into the new product.
- Rename remains a label change on the same id and therefore shows on existing lists and statistics.
- Archived articles disappear from new-assignment choices and remain on lists and in statistics where already assigned.
- Clients that drop archived items from the in-memory catalog will show stale group labels. They must not do that.
- List duplicate is `POST /api/garments/lists/:id/duplicate`. The client must not create the list and then assign articles.

## Rejected

- Name snapshot on the list join. It fights label corrections and adds a second source of truth.
- Reusing Cups `deleted_at` or Clubdesk `publication_status`. Those mean hidden or unpublished, not “inactive in the catalog but still historical.”
- Soft-delete that nulls list foreign keys. History would lose the article.
- A query flag or body field that makes `POST` assign skip the archive check. That bypass is easy to call from the assignment UI.
- `copyFromListId` on create while the client still copies persons and joins in later requests. A failed later request still leaves a partial list.
- The client deleting the new list when assign returns 409. Cleanup is a second failure point, and the copy would still be a new assignment.
