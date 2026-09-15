# ADR — Plugin frontend template: Contacts-class mail-layout

**Status:** Accepted  
**Date:** 2026-09-15  
**Scope:** `templates/plugin-frontend-template/` and new CRUD plugin scaffolds copied from it.

## Context

The golden frontend template previously documented and scaffolded a **card-column** list shell (`ListToolbar`, cards 1/2/3, `*ListItem`, persisted `listViewMode` / `columnCount`). Production CRUD plugins (Contacts, Notes, Tasks, Requests, Teams, Matches, Garments, …) migrated to a **Contacts-class mail-layout**: table-only list, 20/80 desktop split, detail column for preview/create/edit, and page-header bulk/search chrome.

Stale checklist and template docs caused new plugins to copy obsolete list patterns.

## Decision

1. **`templates/plugin-frontend-template/` is the Contacts-class mail-layout scaffold** — verified structure:
   - `YourItemList.tsx` — 20/80 grid (`grid-cols-[minmax(220px,20%)_minmax(0,1fr)]`), table-only, Sort + Select/Clear + `BulkActionRoundBar` + `RoundExpandableSearch`, inline create/edit via `InlinePanelFormActions`.
   - `YourItemListTable.tsx` — table rows only (no `YourItemListItem`).
   - `YourItemQuickContextPanel.tsx` — `variant="list" | "full"`; mail-layout detail column renders `YourItemView` (full QC), not a separate sticky list-side QC card.
   - `YourItemDetailHeaderMenus.tsx` — thin `DetailHeaderMenus` wrapper.
   - `YourItemView.tsx` — always full QC + EXAMPLE `overview | details` tab chips via `headerBelow`.
   - `YourItemsStatisticsView.tsx` — empty detail pane (title + one line; no KPIs).
   - `YourItemsSettingsView.tsx` — empty settings shell; **no** layout prefs.
   - Removed: `YourItemListItem.tsx`, `yourItemColumnCount.ts`, `yourItemListViewMode.ts`.

2. **Default for new CRUD scaffolds:** copy this mail-layout. **Do not** add `listViewMode`, `columnCount`, `ListToolbar`, or card grids to new plugins.

3. **Registry requirement:** Contacts-class CRUD plugins register with `contentFlush: true` and `contentOwnsScroll: true` in `client/src/core/pluginRegistry.ts` (same as `contacts`) so the shell does not scroll the page and list columns own overflow.

4. **Backend template unchanged:** no list-layout `/settings` routes; do not document `listViewMode` / `columnCount` as template defaults (legacy plugins may still use AppContext user settings).

5. **50/50 sticky quick-context aside** (separate `*QuickContextPanel` beside the list) is **legacy/alternate** — not the golden template. Use only when product explicitly requires that pattern; otherwise follow mail-layout.

6. **Template location:** `templates/plugin-frontend-template/` remains outside `client/src/` and is not linted until copied into `client/src/plugins/<name>/`.

## Canonical references

| Area                 | Reference                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Golden template list | `templates/plugin-frontend-template/components/YourItemList.tsx`                           |
| Production list      | `client/src/plugins/contacts/components/ContactList.tsx`                                   |
| Full view + tabs     | `templates/.../YourItemView.tsx`, `client/src/plugins/contacts/components/ContactView.tsx` |
| Registry flags       | `client/src/core/pluginRegistry.ts` (`contacts` entry)                                     |
| View guide           | [`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](../../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md)         |

## Consequences

- Checklists (`NEW_PLUGIN_INTEGRATION_CHECKLIST`, `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST`, `templates/README`) must describe mail-layout, not card-column.
- New plugins scaffolded from the template should register `contentFlush` + `contentOwnsScroll`.
- Historical CHANGELOG entries mentioning card-column template sync remain accurate for their dates; this ADR supersedes template list guidance from 2026-08-14 onward.

## Non-goals

- Migrating legacy plugins that still use cards/column prefs (Files, Slots, …) — out of scope for the template change.
- Changing `templates/plugin-backend-template/` list-layout comments in this ADR (backend template code unchanged).
