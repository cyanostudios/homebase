# ADR: ListFilterStatCard multi-select

**Status:** Accepted  
**Date:** 2026-08-11  
**Context:** Matches list filters use multi-select (`string[]`, empty = All, exclusive time windows, AND with facets). Product asked to apply the same interaction across plugin lists.

## Decision

1. **Shared mechanics** live in `client/src/core/list/listFilterSelection.ts`:
   - `toggleListFilterSelection(current, filter, exclusiveGroups)`
   - `itemMatchesListFilters(item, filters, matchOne)` — empty → match all; else AND
2. **Per-plugin** owns filter union (no `'all'` in the array), exclusive groups, and `matchOne` predicates.
3. **Exclusive groups** for mutually exclusive dimensions (status/lifecycle, time windows). Facets toggle independently and AND with the rest.
4. **All** card always clears to `[]`. Selection never stores `'all'`.
5. **Non-All defaults** (e.g. Tasks `open`, Requests `active`) may use a non-empty **initial** selection; All still clears to `[]`.
6. **No backend** filter API for this convention; client-side on loaded lists.
7. **Non-goal:** OR-union within a status group. If needed later, require a new ADR.

## Consequences

- Users can combine orthogonal facets (e.g. tags + company) the same way as Matches home + 7 days.
- Conflicting statuses cannot both stay selected (exclusive replace).
- Large consistent rollout across list plugins (incl. Mail/Pulse history); Matches is a thin adapter over core.
- Compact secondary chips (gender, type, schedule teams) stay separate from this ADR unless product asks to unify them.
