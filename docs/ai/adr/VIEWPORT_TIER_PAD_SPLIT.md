# ADR — Viewport tier + pad list|detail split

**Status:** Accepted  
**Date:** 2026-08-24  
**Scope:** Client shell + generic list display overrides (phone / pad / desktop).  
**Companion delta (2026-09-08):** Desktop companion is a **global right-rail flyout** (~640px, MVP Schedule), not a side-by-side panel in `MainLayout`. See Decision §4 desktop bullet and [`UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md) § App right sidebar.

## Context

UI/UX design (etapp 1) requires three surfaces: phone (&lt;768), pad (768–1023), desktop (≥1024). Prior code used a binary `useIsMobile` (&lt;768) and treated iPad as desktop (permanent sidebar, detail replaces list).

## Decision

1. **`ViewportTier`:** `'phone' | 'pad' | 'desktop'` via `useViewportTier()` / `getViewportTier(width)` in `client/src/hooks/useMediaQuery.ts`.
2. **`useIsMobile()`** remains phone-only (`max-width: 767px`) for backward-compatible call sites that mean “compact phone”.
3. **Permanent sidebar + main `pl-[252px]`** start at Tailwind **`lg` (1024px)**. Pad and phone use overlay Sheet nav + floating Menu control (`lg:hidden`; see ADR `SHELL_NO_TOPBAR.md`).
4. **Detail presentation:**
   - phone → full-height panel in `main` (`DetailPanel` `isMobile`; bottom actions bar)
   - pad → list and detail mounted together (split ~38% / remainder, list `min-w-[280px]`)
   - desktop → detail replaces list; optional **companion flyout** on the right rail (wider ~640px overlay; MVP Schedule via `canOpenAsCompanionFor` + `getCompanionCandidates`, global when plugin enabled). Primary plugin keeps full width inside `<main>`; companion stays open across plugin changes; not a MainLayout split; not shown on phone/pad.
5. **List display:** Plugin lists are **table-only** (`SortableListTable`) on all viewport tiers. Legacy `effectiveListViewMode.ts` cards clamps are obsolete for list chrome (prefer delete in a follow-up cleanup).
6. **No layout toggle:** Do not reintroduce `ListColumnLayoutToggle` / cards vs table switching.
7. **`MobileBottomBar`:** remains phone-only (`md:hidden`).

## Consequences

- Call sites that used `md:` for “desktop chrome” (sidebar offset, hamburger) must use `lg:` where the design means permanent rail.
- List headers / filter grids that used `hidden md:*` already appear on pad; filter grids prefer `grid-cols-2` until `lg`.
- Desktop **plugin** companion flyout (rail overlay, primary full width) is in scope; pad list|detail split remains separate.

## Non-goals

- Per-plugin visual redesign, dashboard, native apps.
- Resizable companion divider, URL-synced companion state, nested detail panels inside companion (MVP).
- Side-by-side Companion Panel inside `main` (superseded 2026-09-08 by rail flyout).
