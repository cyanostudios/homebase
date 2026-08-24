# ADR — Viewport tier + pad list|detail split

**Status:** Accepted  
**Date:** 2026-08-24  
**Scope:** Client shell + generic list display overrides (phone / pad / desktop).

## Context

UI/UX design (etapp 1) requires three surfaces: phone (&lt;768), pad (768–1023), desktop (≥1024). Prior code used a binary `useIsMobile` (&lt;768) and treated iPad as desktop (permanent sidebar, detail replaces list).

## Decision

1. **`ViewportTier`:** `'phone' | 'pad' | 'desktop'` via `useViewportTier()` / `getViewportTier(width)` in `client/src/hooks/useMediaQuery.ts`.
2. **`useIsMobile()`** remains phone-only (`max-width: 767px`) for backward-compatible call sites that mean “compact phone”.
3. **Permanent sidebar + main `pl-[252px]`** start at Tailwind **`lg` (1024px)**. Pad and phone use overlay Sheet nav + TopBar hamburger (`lg:hidden`).
4. **Detail presentation:**
   - phone → full-height panel in `main` under TopBar (`DetailPanel` `isMobile`; bottom actions bar)
   - pad → list and detail mounted together (split ~38% / remainder, list `min-w-[280px]`)
   - desktop → detail replaces list (unchanged)
5. **List display overrides** (`effectiveListViewMode.ts`) take `ViewportTier`:
   - phone: cards, 1 grid column, card content as column-2
   - pad: cards, clamp grid columns to max 2; card content follows clamped count
   - desktop: persisted preference
6. **`ListColumnLayoutToggle`:** hidden on phone; pad shows **1 | 2** only; desktop shows **1 | 2 | 3 | table**.
7. **`MobileBottomBar`:** remains phone-only (`md:hidden`).

## Consequences

- Call sites that used `md:` for “desktop chrome” (sidebar offset, hamburger) must use `lg:` where the design means permanent rail.
- List headers / filter grids that used `hidden md:*` already appear on pad; filter grids prefer `grid-cols-2` until `lg`.
- Desktop split is explicitly out of scope (future).

## Non-goals

- Per-plugin visual redesign, dashboard, desktop split, native apps.
