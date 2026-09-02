# ADR — App shell without TopBar

**Status:** Accepted  
**Date:** 2026-09-02  
**Scope:** Client app shell (`MainLayout`, left sidebar, phone/pad chrome).

## Context

The fixed TopBar (brand, breadcrumbs, mobile hamburger, phone/pad user menu) consumed vertical space. UX and architecture decided to remove it and relocate its responsibilities.

## Decision

1. **No TopBar** — remove `TopBar` and breadcrumb wiring (`detailPanelBreadcrumbLabel`).
2. **Brand in left sidebar** — `SidebarBrand` (logo + org name) at the top of the permanent sidebar and mobile nav sheet; display-only (not a navigation control).
3. **Floating phone/pad controls** — `MobileShellControls` (`z-40`, `lg:hidden`): Menu (top-left, hidden while sheet open) and `MobileUserMenu` (top-right). Desktop keeps `AppRightSidebar` for account/settings.
4. **Top inset** — `MainLayout` applies `MOBILE_SHELL_TOP_INSET_CLASS` (`pt-14`) on `main` for phone and pad so content clears floating controls.
5. **Z-index** — sidebar `z-30` (edge collapse control may overlap content gutter); floating chrome / bottom bar `z-40`; Sheet/dialogs `z-50`.
6. **Desktop collapse** — left sidebar can collapse to an icon rail (`LEFT_SIDEBAR_COLLAPSED_WIDTH_PX` = 72): brand logo only + category icons; edge `RoundIconLabelButton` (`ChevronLeft`/`ChevronRight`, `size="xs"`, top of rail) toggles expand/collapse (persisted in `localStorage` key `homebase.leftSidebar.collapsed`). `id="left-sidebar-nav"` is set only on the permanent desktop rail (`navId`), not the phone/pad Sheet. Phone/pad overlay Sheet is unchanged.

## Consequences

- Permanent sidebar no longer uses `pt-14` TopBar clearance; brand occupies that band.
- Settings remains reachable via user menu (phone/pad) or right rail (desktop), not via sidebar nav.
- Update shell docs and ADR `VIEWPORT_TIER_PAD_SPLIT.md` references that mentioned TopBar hamburger.

## Non-goals

- Redesign of ContentHeader, MobileBottomBar actions, plugin views, or public-cups filter breadcrumbs.
