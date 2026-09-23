# ADR — Notes / Tasks / Requests companions (desktop right rail)

**Status:** Accepted (Solution Architect) — implemented locally  
**Date:** 2026-09-23  
**Scope:** Client shell + notes/tasks/requests List embeds only. **No backend / API / migration.**

**Related:** Contacts companion [`CONTACTS_COMPANION.md`](./CONTACTS_COMPANION.md); Garments inventory [`GARMENTS_INVENTORY_COMPANION.md`](./GARMENTS_INVENTORY_COMPANION.md); platform helpers [`companionPrimarySurface.ts`](../../../client/src/core/companion/companionPrimarySurface.ts); UI [`UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md) § App right sidebar.

---

## Context

Operators need Notes, Tasks, and Requests visible while working in other plugins without leaving the primary task. Contacts already established the browse/read companion pattern (list → soft preview with `readOnly` View → Open full escape). These three plugins follow the same shape.

---

## Decision

1. **Registry** — Each entry opts in with:
   - `canOpenAsCompanionFor: ['teams']` (host-reserved; discovery is platform-wide when the plugin is enabled).
   - `companionHideOnPrimaryPages: ['notes' | 'tasks' | 'requests']`.
   - `companionRailTitleNavPage` matching the plugin name.
   - `companionRailIcon`: `StickyNote` / `CheckSquare` / `Inbox`.

2. **List `isCompanion`** — Same guards as Contacts: no split/settings/Add/bulk/toolbar portal; keep search/sort/filter; force title-only columns; row soft-select replaces list with `*View` `readOnly` + Open full / Close.

3. **View `readOnly` tabs** (local; no primary `?tab=` mutation):
   - **Notes:** `information`, `files` (if files plugin enabled). Drop linked + activity. Hide share chrome.
   - **Tasks:** `information`, `assignees`. Drop linked + activity. Assignees/status display-only.
   - **Requests:** `information`, `assignees`, `files` (if files enabled). Drop activity. Assignees/fields display-only.

4. **Open full** — `closeCompanionPanel()` + existing `openNoteForView` / `openTaskForView` / `openRequestForView`.

5. **No backend changes.**

---

## Out of scope

- Phone/pad companion.
- Linked/activity (and create/edit/bulk/delete) inside the flyout.
- Nested DetailPanel inside the flyout.
- New API routes or server flags.
