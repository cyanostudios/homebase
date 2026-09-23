# ADR — Garments inventory companion (desktop right rail)

**Status:** Accepted (Solution Architect) — implemented locally  
**Date:** 2026-09-22 (amended 2026-09-23 for view-only + Open full escape + column/hygiene sync)  
**Scope:** Client shell + garments List embed only. **No backend / API / migration.**

**Related:** Platform companion rail ([`CHANGELOG.md`](../../CHANGELOG.md) 2026-09-08 Schedule flyout); helpers [`client/src/core/companion/companionPrimarySurface.ts`](../../../client/src/core/companion/companionPrimarySurface.ts); operator notes [`GARMENTS_PLUGIN.md`](../../GARMENTS_PLUGIN.md); UI [`UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md) § App right sidebar.

---

## Context

Operators need inventory visibility while working in other plugins (e.g. Teams) without leaving the primary task. Schedule already uses the desktop right-rail companion flyout. Garments adds a second companion candidate with a **narrower embed**: inventory table only, not lists or settings. Default interaction is browse/read; leaving the companion to edit a specific article is an explicit escape hatch.

---

## Decision

1. **Registry (`garments` entry)** — Opt in via existing companion fields:
   - `canOpenAsCompanionFor: ['teams']` (same host-reserved pattern as Schedule; discovery is platform-wide when garments is enabled).
   - `companionHideOnPrimaryPages: ['garments-inventory']` — hide rail toggle and close flyout when Inventory is the primary page (`/garments/inventory`). Lists primary (`/garments`) does **not** hide the toggle.
   - `companionRailTitleNavPage: 'garments-inventory'` — flyout/rail title uses `nav.garments-inventory`.
   - `companionRailIcon: Package` (Lucide).

2. **Shared hide/title/icon resolution** — `companionPrimarySurface.ts`:
   - `resolveCompanionHideOnPrimaryPages` → explicit array or fallback `[plugin.name]`.
   - `shouldHideCompanionRailForPrimary` / `shouldCloseCompanionForPrimary` used by `AppRightSidebar` and `AppContent`.

3. **Render path** — `AppRightSidebar` mounts registry `List` with `isCompanion` inside `RightSidebarFlyout` at `RIGHT_SIDEBAR_COMPANION_FLYOUT_WIDTH_PX` (~480px). Desktop only (`hidden lg:block`); `AppContent` closes companion when viewport leaves desktop. Flyout body owns vertical scroll (`overflow-y-auto`); companion List uses `PLUGIN_PAGE_COMPANION_SHELL_CLASS` + companion section gap.

4. **`GarmentList` companion mode** — When `isCompanion`:
   - Treat surface as inventory (`isInventoryEffective`); do **not** mutate `garmentsContentView` for companion mode.
   - Disable desktop mail split, settings view, list header title/gear, `useMobileActions` / `useRegisterMobileSearch`, toolbar edge portal, Add, and select/bulk.
   - **Browse default (view-only):** row activate soft-selects `previewInventory` and **replaces** the list with **`InventoryQuickContextPanel` `readOnly`** plus **Close** (`headerTrailing` → clear preview). No auto-open of global `DetailPanel` from row click.
   - Local tabs in read-only QC (do not mutate primary URL `?tab=`).
   - **Explicit escape — Open full item:** `ExternalLink` + `garments.quickContext.openFullProfile` closes the companion, navigates to `/garments/inventory`, and calls `openInventoryForView(item)` so the article opens on the full inventory surface.

5. **Table columns** — Same as full inventory: `articleName` only (`resolveVisibleInventoryTableColumns` ignores legacy prefs; brand/qty/price in identity meta). Inventory settings has **no** Table columns category. Multi-column table defs / `companionLayout` were removed (UI Hygiene 2026-09-23).

6. **No backend changes** — Companion reuses existing garments plugin APIs, CSRF, and tenant plugin gating.

---

## Consequences

- Companion is a **browse/read** surface so operators can keep inventory visible while editing another plugin; mutations stay on the full inventory page / Lists unless the user chooses **Open full item**.
- Two companion plugins may appear on the rail when both Schedule and Garments are enabled (mutually exclusive flyouts; one `companionPlugin` in session storage).
- Full inventory UX (settings, import, mail-layout split, edit/create) remains on `/garments/inventory` only.
- QA **Godkänt** and Security **Godkänt** (2026-09-23) for this UI-only slice; tracked separately from Schedule’s 2026-09-08 approval. Invoices ML VAT remains a separate epic (not covered by companion Security).

---

## Out of scope

- Phone/pad companion or mobile inventory rail.
- Lists surface in companion.
- Edit/create/bulk **inside** the companion flyout (Open full item leaves companion to edit on the primary page).
- Nested DetailPanel hosted inside the flyout.
- New API routes or inventory-specific server flags.
