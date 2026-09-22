# ADR: Garments Size summary procurement

**Status:** Accepted  
**Date:** 2026-09-22  
**Context:** Garments list Size summary needed stacked layout plus ability to check off supplier/batch orders (ordered + quantity) without conflating person-matrix `inv_*_ordered` fulfillment.

## Decision

Store list-level procurement progress in `garment_lists.fit_summary_procurement` (JSONB), keyed by inventory item id and audience/size breakdown (`audience` + U+001F + `size`; not U+0000 — PostgreSQL JSONB rejects null bytes). Expose via list payloads and `PATCH /api/garments/lists/:id/fit-summary-procurement` (deep partial merge). Admin Size summary UI is stacked by article with Ordered checkbox + Qty ordered; public share shows counts only.

## Consequences

- Person `checkbox_values` Ordered remains independent (no auto-sync).
- Unassigning an inventory item strips its procurement keys.
- Duplicate list creates empty procurement (`{}` default).
