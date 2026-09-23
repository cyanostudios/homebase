# ADR — Contacts companion (desktop right rail)

**Status:** Accepted (Solution Architect) — implemented locally  
**Date:** 2026-09-23  
**Scope:** Client shell + contacts List embed only. **No backend / API / migration.**

**Related:** Platform companion rail ([`CHANGELOG.md`](../../CHANGELOG.md) 2026-09-08 Schedule flyout; 2026-09-22 Garments inventory companion); helpers [`client/src/core/companion/companionPrimarySurface.ts`](../../../client/src/core/companion/companionPrimarySurface.ts); UI [`UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md) § App right sidebar; pattern ADR [`GARMENTS_INVENTORY_COMPANION.md`](./GARMENTS_INVENTORY_COMPANION.md).

---

## Context

Operators need contact visibility while working in other plugins (e.g. Teams) without leaving the primary task. Schedule and Garments already use the desktop right-rail companion flyout. Contacts adds a third companion candidate: browse/read contact list with a ContactView-shaped preview (information, addresses, persons) — no linked/activity and no create/edit/delete in the flyout.

---

## Decision

1. **Registry (`contacts` entry)** — Opt in via existing companion fields:
   - `canOpenAsCompanionFor: ['teams']` (same host-reserved pattern as Schedule/Garments; discovery is platform-wide when contacts is enabled).
   - `companionHideOnPrimaryPages: ['contacts']` — hide rail toggle and close flyout when Contacts is the primary page (`/contacts`).
   - `companionRailTitleNavPage: 'contacts'` — flyout/rail title uses `nav.contacts`.
   - `companionRailIcon: Users` (Lucide).

2. **Shared hide/title/icon resolution** — Reuse `companionPrimarySurface.ts` (no new shell APIs).

3. **Render path** — `AppRightSidebar` mounts registry `List` with `isCompanion` inside `RightSidebarFlyout` at `RIGHT_SIDEBAR_COMPANION_FLYOUT_WIDTH_PX` (~480px). Desktop only; flyout body owns vertical scroll with tight inset; companion Lists use `PLUGIN_PAGE_COMPANION_SHELL_CLASS`.

4. **`ContactList` companion mode** — When `isCompanion`:
   - Disable desktop mail split, settings view, list header title/gear, `useMobileActions` / `useRegisterMobileSearch`, toolbar edge portal, Add, and select/bulk.
   - Force table columns to `name` only (`COMPANION_VISIBLE_COLUMN_IDS`); full `/contacts` keeps user column prefs.
   - **Browse default (view-only):** row activate soft-selects `previewContact` and **replaces** the list with **`ContactView` `readOnly`** plus **Close** / **Open full** in `headerTrailing`.
   - Local tabs in read-only view (do not mutate primary URL `?tab=`): information (+ properties), addresses, persons. No linked or activity.
   - **Explicit escape — Open full item:** `ExternalLink` + `contacts.quickContext.openFullProfile` closes the companion and calls `openContactForView(contact)` (slug URL `/contacts/{slug}`).

5. **`ContactView` / `ContactQuickContextPanel` `readOnly`** — Hide `ContactDetailHeaderMenus`; assignable and tags are display-only; person invoice-reference checkbox is disabled. Mailto/tel/web copy links remain.

6. **No backend changes** — Companion reuses existing contacts plugin APIs, CSRF, and tenant plugin gating.

---

## Consequences

- Companion is a **browse/read** surface so operators can keep contacts visible while editing another plugin; mutations stay on the full contacts page unless the user chooses **Open full item**.
- Up to three companion plugins may appear on the rail when Schedule, Garments, and Contacts are enabled (mutually exclusive flyouts; one `companionPlugin` in session storage).
- Full contacts UX (settings, import, mail-layout split, edit/create, linked, activity) remains on `/contacts` only.

---

## Out of scope

- Phone/pad companion or mobile contacts rail.
- Linked and activity surfaces in companion.
- Edit/create/bulk/delete/duplicate **inside** the companion flyout (Open full item leaves companion to edit on the primary page).
- Nested DetailPanel hosted inside the flyout.
- New API routes or contacts-specific server flags.
