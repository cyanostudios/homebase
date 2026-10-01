# ADR: Clubdesk inventory archive

**Status:** Accepted  
**Date:** 2026-09-30  
**Scope:** Clubdesk inventory articles. Same catalog rule as garments inventory archive, mapped onto price lists and the public catalog.

## Decision

1. **Archive flag.** Nullable `archived_at` on `clubdesk_inventory_items` (migration **176**). API field `archivedAt`. Product create/update ignore it.
2. **Explicit archive and restore.** `POST /api/clubdesk/inventory/:id/archive` and `POST .../restore`. Restore that clashes with an active name, brand, or slug returns **409**.
3. **Active uniqueness only.** Partial unique indexes on `(user_id, lower(article_name), lower(brand))` and `(user_id, lower(slug))` where `archived_at IS NULL`.
4. **Hard delete only from archived, and it does not drop price-list history.** Active delete returns **409**. Archived delete returns **409** while a price-list row still points at the article. Otherwise the article is deleted and variants cascade. Delete does not null price-list links.
5. **No new price-list link to an archived article.** Create/update of a price list returns **409** for a new `inventoryItemId` that is archived. An article already on that price list can stay. Unlink is unchanged.
6. **Public catalog hides archived articles.** Published list and product lookup require `archived_at IS NULL`. A price-list line keeps its row and live catalog price, and omits `inventorySlug` while the article is archived.
7. **Admin catalog.** Archived articles stay loaded. The default list hides them. The Archived chip shows only those. A non-empty search in the active list also includes archived matches. Delete in the article menu and bulk delete exist only for archived articles.

## Consequences

- A replacement product is a new inventory row. The previous row is archived.
- Rename stays on the same id, so existing price-list joins still resolve the live article name.
- Local-first. Migration **176** is not a production release.
