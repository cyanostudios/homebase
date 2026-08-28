# Homebase UI & UX Standards (V3 Premium)

**Last Updated:** August 2026

This document defines the strict UI/UX standards for the Homebase V3 "Premium" design language. All plugins must adhere to these guidelines to ensure a cohesive user experience.

## 0. V3.6 Shared UI Primitives

The v3.6 alignment introduced shared primitive behavior that all plugins should rely on instead of local workarounds:

- **`Card` primitive:** `shadow-none` also implies `border-0` (see `client/src/components/ui/card.tsx`).
- **`Table` primitive:** use `rowBorders={false}` for borderless list tables; it clears borders consistently for `thead/tbody/tr/th/td` (see `client/src/components/ui/table.tsx`).
- **`ContentHeader` suffix:** status badges or contextual suffix UI should use `titleSuffix` via layout context (`MainLayout` / `ContentHeader`) instead of ad-hoc title hacks.
- **Detail view tokens:** reuse `client/src/core/ui/detailViewCardStyles.ts` (`DETAIL_VIEW_CARD_CLASS`, `DETAIL_FIELD_LABEL_CLASS`, `DETAIL_NOTE_CALLOUT_CLASS`, `DETAIL_ENTITY_LINK_TRIGGER_CLASS` for ExternalLink + label Open controls — same underline / primary-hover language as list Select all, `DETAIL_LIST_ITEM_HOVER_CLASS` / `DETAIL_LIST_ITEM_TITLE_CLASS`, list filter tokens `LIST_FILTER_CHIP_*` / `LIST_FILTER_CHIP_ROW_CLASS` / `LIST_FILTER_AND_SORT_ROW_CLASS`, etc.) and related helpers in `DetailSection`.
- **Shell content flush:** `ContentSurface` sits flush against the sidebar and top bar (`m-0`, `rounded-none`, `bg-card`). List and detail share `MAIN_CONTENT_SHELL_CLASS` (`rounded-xl bg-background`) so both use the same gray main surface and corner inset. `TopBar` is fixed with a matching flow spacer (`h-14`). Pomodoro / clock / time-tracking live in the **app right sidebar** (`AppRightSidebar`, desktop `lg+` only; collapsed by default), not in the TopBar. `MainLayout` content row uses `lg:pl-[252px]` (permanent left nav) with `AppRightSidebar` as a flex sibling; main keeps `pr-4` from pad up. Phone-only `pb-16` / search `pb-28` so list content clears the phone bottom bar. Pad (768–1023) uses overlay nav + list|detail split — ADR [`ai/adr/VIEWPORT_TIER_PAD_SPLIT.md`](ai/adr/VIEWPORT_TIER_PAD_SPLIT.md). Internal list/detail padding (`p-4 md:p-6` / `flush`) is unchanged.

### 0.1 List view shell (contacts-style, rolled out 2026-04; card columns 2026-07)

All plugin list views should match this shell. **Settings** is excluded (not a data list).

**Card-column list (rolled out 2026-07-24; table mode rolled out 2026-08-09; provider catalogs 2026-08-10)** — reference for **Tasks, Contacts, Notes, Guides, Requests, Slots, Estimates, Matches, Files, Ingest, Cups, Teams, Instructions, Clubdesk** (incl. price lists), **Invoices**, **Mail providers, Pulses providers, AI Providers**:

| Element          | Standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **Layout**       | CSS grid of `*ListItem` cards using `DETAIL_VIEW_CARD_CLASS` (Teams may keep domain `TeamCard` visuals). **Table mode:** header `ListColumnLayoutToggle` (**3 \| table** on desktop); `listViewMode: 'cards' \| 'table'`; table uses shared `SortableListTable` (`rowBorders={false}`, sortable headers). Persist `listViewMode` in plugin settings and/or session (`{plugin}:listViewMode`) — do **not** reuse legacy `viewMode`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Columns**      | Header toggle \*\*3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | table** sets cards (`columnCount: 3`) or table. Persist `columnCount` (always 3 for cards) and/or session; migrate legacy `viewMode` grid→3, list→1. Quick context open on desktop displays **2** columns (preference unchanged). **Viewport tiers** (ADR `ai/adr/VIEWPORT_TIER_PAD_SPLIT.md`): **phone** (&lt;768) — cards + **1** grid column + card content as **column-2**; **pad\*\* (768–1023) — cards + columns clamped to \*\*1 | 2**; **desktop** (≥1024) — full preference including table. Overrides via `effectiveListViewMode.ts`; persisted preferences are not mutated. `ListColumnLayoutToggle`: hidden on phone/pad; **3 | table\*\* on desktop. |
| **Sort**         | Single toolbar sort field (`w-[140px]`) + shared asc/desc toggle (cards only). Per-plugin `*ListSort.ts` / `compare*ByField`. Client-only, not persisted. Known limits: Contacts `tags` = first tag; Notes `mentions` / Guides `languages` = count. **Table mode:** hide toolbar sort controls; click column headers (`nextListTableSort` / same `primarySort` + `sortOrder` state).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Filter stats** | `ListFilterStatCard` + `LIST_FILTER_STAT_ROW_CLASS` (`@/core/ui/ListFilterStatCard`): label+dot left, value right. Phone: compact (`px-3 py-2` / `text-lg`); pad/desktop: full (`md:px-6 md:py-4` / `md:text-3xl`). Hover **and active** use `bg-primary/10` + `text-primary` (active also keeps `ring-1 ring-border/70`). Row: `gap-2`. Typical date/status grids use `md:grid-cols-2 lg:grid-cols-4`. **Multi-select (platform):** empty selection or **All** = all rows; exclusive groups (status/lifecycle, time windows) replace within the group; other facets toggle independently and **AND** with the rest. Shared: `listFilterSelection.ts`; per-plugin `*ListFilter.ts`. Tasks/Requests may start with non-empty initial selection (`open` / `active`); All still clears to `[]`. ADR: `docs/ai/adr/LIST_FILTER_STAT_CARD_MULTI_SELECT.md`. **Matches:** optional fifth card when settings `defaultHomeTeam` is set — grid becomes `lg:grid-cols-5`; card label is the configured name; filters `home_team` with trim + case-insensitive **prefix** (exact or continues after a space). **Matches statistics** content view: Club + per-team shells use `DETAIL_VIEW_CARD_CLASS` (Contacts Linked pattern); Total/Home/Away metrics via `StatCompactPanel` in `lg:grid-cols-3` (`MatchSideSplitSection`); team multi-select chips (`LIST_FILTER_CHIP_*` + `LIST_FILTER_CHIP_ROW_CLASS`, empty = all / show Club). Not `ListFilterStatCard` for W/D/L. Compact secondary chips (Teams gender, Requests types, **Schedule teams multi-select**, **Teams Matches tab** home/away vs upcoming-by-date): `LIST_FILTER_CHIP_CLASS` / `_ACTIVE` in `LIST_FILTER_CHIP_ROW_CLASS` + `LIST_FILTER_AND_SORT_ROW_CLASS` when sort sits beside chips — **phone/pad (&lt;1024px):** horizontal scroll (`flex-nowrap overflow-x-auto`); **`lg+` (≥1024px):** wrap; filter + sort stacked below `lg`, inline and vertically centered from `lg`. Schedule empty selection = all teams. Large chips (Teams detail tabs Overview/Schedule): `LIST_FILTER_CHIP_LG_*`. **Legacy** per-plugin dashboard cards (registry `dashboardWidget`): `DASHBOARD_WIDGET_CARD_CLASS` + Open via `LIST_FILTER_CHIP_CLASS` — **not** used by home dashboard v1 shell. **Phone:** compact chips (`px-3 py-2` / `text-lg`, `min-w-[8.75rem]`) in a horizontal scroll row via `LIST_FILTER_STAT_ROW_CLASS` (`flex` + `overflow-x-auto`, scrollbar hidden); **pad/desktop:** full cards (`md:px-6 md:py-4` / `md:text-3xl`) in a grid (`md:grid` + `md:grid-cols-2` … `lg:grid-cols-*`). |
| **Rhythm**       | `space-y-3` between filter stats, unified `ListToolbar`, items, and footer on all breakpoints (including phone — do not use `space-y-0 md:space-y-*`). Within the filter-stat row: `gap-2`. List page surface uses `bg-background` (light token `210 20% 96%`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Row content**  | Badges top-left; optional compact status control top-right when the entity has status; bold title; optional plain excerpt; meta row. When toolbar `columnCount === 1`, meta sits on the top row with badges; for 2/3 columns meta stays below title/excerpt (Tasks, Contacts, Notes, Requests, Estimates, Matches, Guides, Slots, Files, Ingest, Cups, Teams). List card hover: `DETAIL_LIST_ITEM_HOVER_CLASS` (`hover:bg-primary/10`); title uses `DETAIL_LIST_ITEM_TITLE_CLASS` (`group-hover:text-primary`) like filter chips. Teams `TeamCard`: no colored top stripe. Contacts: assignable indicator = small green/red dot (top-right; green = assignable, red = not). Estimates: status via compact dropdown only (no duplicate status badge).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **List toolbar** | Shared `ListToolbar` (`@/core/ui/ListToolbar`): one row. Idle (`selectedCount === 0` and not `selectionMode`): **Select all** + optional **Quick task/note/request** (`leadingActions`, left); right group = optional **`beforeSearch`** → **search** (`ListSearchInput` with clear **X** when non-empty) → sort + column **3/table** (`ListColumnLayoutToggle` in page header actions). Quick-add open: form takes the whole row (`quickAddOpen` / `quickAddExpanded`; full-width input at normal control height `h-9`). Selection (`selectedCount > 0` **or** `selectionMode`): bulk actions replace that row (search/sort/columns hidden). Plugins with toolbar quick-add: Tasks, Notes, Requests (`*QuickAdd` + `layout="toolbar"`). **Phone:** entire `ListToolbar` card hidden (search stays mounted for bottom-bar registration; no sort/select-all). **Pad/desktop:** full toolbar with inline search. **Canonical list header (2026-08-27+):** **Select** / **Clear** in the title row (`alwaysExpanded`); bulk via `BulkActionRoundBar`; search + \*\*3                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | table\*\* toggle + Add in `PLUGIN_PAGE_HEADER_ACTIONS_CLASS` (not `ListToolbar`). Checkboxes hidden until Select.                                                                                                                                                                                                                                                                                                                       |
| **List footer**  | Shared `ListFooterBar`: transparent surface (no white card); “Showing X of Y” left-aligned. Parent list column uses `gap-3` on all breakpoints (no `gap-0 md:gap-3`, no negative footer margin). Optional `leading` reserved; Tasks/Notes/Requests quick-add lives in the toolbar, not the footer or grid.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Empty state**  | Shared `ListEmptyState` (`@/core/ui/ListEmptyState`): muted card + short copy (`No X yet` / `*.noYet`). When the list is **truly empty** (no search/filter), show a primary **Create** button under the text that calls the same open-create handler as desktop header Add / mobile bottom-bar Add (`attemptNavigation(() => openXPanel(null))`). When results are empty due to search/filter (“no match”), show match copy only — **no** Create button. Do not embed “Click Add…” prose in `noYet`; the button replaces that hint. Reference: instructions list; golden template `YourItemList.tsx`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Bulk actions** | Plugin-specific actions in `ListToolbar` `bulkActions` when selecting. Neutral actions: hover `bg-primary/10` + `text-primary`. Clear selection matches Delete red hover.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Bulk status**  | Where the entity has a status/lifecycle field (Tasks, Guides, Requests): bulk **Status** action → `*BulkStatusDialog` (sequential updates). Contacts: bulk **Assignable** → `ContactBulkAssignableDialog` (Yes/No; sequential `PUT` with full contact payload, same class as bulk tags). Contacts/Notes/Slots/Cups: no lifecycle-status bulk (Slots/Cups keep BulkProperties).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Provider-kataloglistor (**Mail**, **Pulses**, **AI Providers**) följer card-column-shell ovan men **utan** radmarkering/bulk (`selectedCount={0}`); history-vyer är separata undersidor, inte huvudlistan.

### 0.2 Phone / pad / desktop chrome (viewport tiers, 2026-08-24)

Viewport tiers: **phone** &lt;768, **pad** 768–1023, **desktop** ≥1024. ADR: [`ai/adr/VIEWPORT_TIER_PAD_SPLIT.md`](ai/adr/VIEWPORT_TIER_PAD_SPLIT.md).

| Element              | Standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sidebar**          | Permanent 252px rail from **`lg`** (desktop). Phone and pad use overlay Sheet via TopBar hamburger (`lg:hidden`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Right sidebar**    | Desktop only (`AppRightSidebar`, `hidden lg:flex`). Collapsed ~40px / expanded ~280px; default **closed**. Hosts widgets (`getTopBarWidgets`), Settings category shortcuts, and portaled `DetailLayout` `sidebar` when open. Phone/pad: not shown — detail third column stays inline.                                                                                                                                                                                                                                                                                                                                     |
| **Detail**           | Phone: full-height panel in `main` (under TopBar). Content fills the panel; Edit/Close (Save/Update) are **fixed** to the viewport bottom (portaled, always visible) with translucent chrome. Panel title/subtitle omitted in view mode (title lives in the cards). Pad: list\|detail split (~38% / rest, list `min-w-[280px]`). Desktop: detail replaces list; panel header matches list page header (`px-6 py-4`, `items-start`, `gap-4`, title `text-xl` + subtitle stacked, actions `gap-1`). Outer content inset: `px-2 sm:px-3` (phone) / `px-6` (pad/desktop, same as list). Shared tokens: `pluginPageStyles.ts`. |
| **Bottom bar**       | Phone only (`md:hidden`): floating translucent `MobileBottomBar` (`bg-background/30` + `backdrop-blur-sm`, same chrome as detail Edit/Close) — **Search**, **Add**, **Settings**. Hidden when detail is open. Plugin settings, core Settings, and stats overlays replace it with **Close** (+ **Save** when dirty) via `useMobileBarOverride`. Safe-area inset on the outer padding.                                                                                                                                                                                                                                      |
| **Actions wiring**   | Each plugin list registers `useMobileActions({ onAdd, onSettings })` (clears on unmount). Same handlers as list header Add/Settings.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Search**           | Phone: via bottom bar above the nav (`useRegisterMobileSearch`). Pad/desktop: inline in `ListToolbar`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **List page header** | Title + Settings/Add is **`hidden md:flex`** (phone-hidden; visible on pad/desktop). Same chrome as detail: `items-start justify-between gap-4`, page shell `px-4 pt-2 pb-4 md:px-6 md:py-4`, title `PLUGIN_PAGE_TITLE_CLASS` (`text-2xl font-extrabold tracking-tight`; mobile title input may use `text-xl`) + subtitle `text-sm` stacked (`space-y-1`). Exceptions: Schedule / Core Settings as before.                                                                                                                                                                                                                |
| **Provider**         | `MobileActionsProvider` wraps the authenticated shell in `MainLayout`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Selection / bulk** | Phone: hide select-all/bulk/checkboxes. Pad/desktop: selection enabled (pad has no table mode).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

### 0.3 Home dashboard (v1, 2026-08-24)

Composed start page — not a grid of `dashboardWidget` cards. Operator detail: [`HOME_DASHBOARD.md`](HOME_DASHBOARD.md).

| Element         | Standard                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------- |
| **Shell**       | `Dashboard.tsx`: `px-4 pt-2 pb-4 md:px-6 md:py-4`, `max-w-screen-2xl`, `space-y-6`             |
| **Surfaces**    | Section cards: `rounded-xl bg-white p-4 shadow-sm dark:bg-slate-950`                           |
| **KPI**         | `grid-cols-2 lg:grid-cols-4`; large tabular number + “Open →” link (not whole-card click)      |
| **Main / side** | `lg:grid-cols-3` with activity `lg:col-span-2`                                                 |
| **Charts**      | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`; SVG donuts / stacked bar (no chart library)       |
| **Visibility**  | Entire sections omit when relevant plugins are disabled; empty page uses `dashboard.noWidgets` |

**Legacy table/grid shell** (still applies to plugins not yet migrated, e.g. schedule):

| Element              | Standard                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Panel surface**    | `overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950`                                                                               |
| **Toolbar**          | Search + settings + grid/list in the **same** panel top row as the list                                                                                  |
| **Grid/list toggle** | Wrapper: `inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5`; buttons: `h-7 rounded-[6px] px-2 text-xs` + clear active state |
| **Table**            | `rowBorders={false}`; header `bg-slate-50/90 dark:bg-slate-900/50`                                                                                       |
| **Grid cards**       | `rounded-xl border-0 … shadow-sm`                                                                                                                        |
| **Badges**           | `border-0 rounded-md px-2 py-0.5 text-xs font-semibold`; subtle fill, not outline                                                                        |

**Additional reference implementations (2026-06):**

- **Grid cards:** `TeamCard` (`client/src/plugins/teams/components/TeamCard.tsx`) — age/color avatar, status badge, player count; **series teams as badges** (`TeamSeriesTeamBadges` / `SeriesTeamBadge`, all entries via `getDisplaySeriesTeams` — not count-only); next training and/or next match meta; optional break-return countdown (red when &lt; 7 days to ongoing season-break `endDate`). Table mode: non-sortable **Series teams** column in `TeamListTable`. No colored top stripe. Team theme colors (lag + serielag): `black | white | red | blue | green | yellow | orange | purple | teal` (`TEAM_COLORS` / schedule `SCHEDULE_COLORS`); light contrast colors: `white`, `yellow`.
- **Notes focus mode:** `NoteForm` (edit) and `NoteView` (detail) — Focus toggle dims the rest of the view (`bg-slate-950/55`), hides sidebar / secondary sections, Esc or click outside exits. Hint: `notes.focusModeHint`.
- **Time grid:** `ScheduleTimeGrid` (`client/src/plugins/schedule/components/ScheduleTimeGrid.tsx`) — week grid with drag/drop training slots; desktop view toggle **1 | 3 | 7 | stacked** (`ScheduleDaySpanToggle`, session `schedule:daySpan`, prop `visibleDays` for grid modes); chevron prev/next for **1** and **3** only; **stacked** reuses `ScheduleWeekView` (full week, no day-span browse). Mobile always uses `ScheduleWeekView` without the toggle. See ADR [`ai/adr/P-SCHEDULE_DAY_SPAN.md`](ai/adr/P-SCHEDULE_DAY_SPAN.md).
- **Schedule lock toggle:** `ScheduleLockToggle` (`client/src/plugins/schedule/components/ScheduleLockToggle.tsx`) — always-visible clickable icon beside schedule title: red `Lock` when locked, green `Unlock` when open; toggles via `setLockedForSchedule`. Used in `ScheduleList`, `PlanView`, and settings titles.
- **Transient action hint:** `TransientActionHint` + `useTransientActionHint` (`client/src/core/ui/TransientActionHint.tsx`) — small floating helper near the pointer (not a modal). Neutral surface (`bg-background`); red accent on **title**, icon, and top-right close **X** only. Supports **message**, optional **description**, optional **actions** (`{ id, label, onClick }`), optional icon (default `Lock`). Auto-dismiss ~2.6s without actions, ~8s with actions; hover/focus pauses the timer. First consumer: Schedule locked empty-cell click with **Unlock** action.
- **Public request form (conversational):** `/public/request` → `PublicRequestForm` — 3-step wizard (type cards → details with team first → contact). When a type is linked to Garments, details show intake fields from branding `intakeSchema` (not a free-form description path). Page uses `font-poppins`; branding logo/name + `requestTypes` loaded once on mount via `GET /api/requests/public/branding`. Option cards: selected = violet ring + check. Not the authenticated Requests list shell. See [`REQUESTS_PLUGIN.md`](REQUESTS_PLUGIN.md) and [`CHANGELOG.md`](CHANGELOG.md) (plugin routing 2026-08-23; conversational form 2026-08-10).
- **Public Clubdesk listing shell:** `public-clubdesk/` (port 3011) mirrors the same conversational surface (Poppins, `#f9fafb`, violet accent, `conv-panel`, option cards, grid atmosphere, no gradient). Hem lists published guides **and** price lists as option cards. Guide step detail (`guide.php`) is a separate UI. See ADR [`ai/adr/CLUBDESK_PUBLIC_COMPANION.md`](ai/adr/CLUBDESK_PUBLIC_COMPANION.md).

## 1. List Views (Tables)

### Checkbox Standardization (Strict)

Round checkboxes align with `RoundIconLabelButton` (secondary idle, primary checked). Prefer shared tokens over raw square inputs.

- **Column width:** Checkbox column `TableHead` / `TableCell`: `w-8` (Contacts) or `w-12` where legacy tables still use wider column — keep width **reserved** even when checkboxes are hidden (avoids layout shift).
- **Classes:** `CHECKBOX_CLASS` + `CHECKBOX_SM_CLASS` from `@/core/ui/checkboxStyles`, or global `.hb-checkbox` via `index.css` (applies to native `input[type=checkbox]` unless `.sr-only` / `data-checkbox-unstyled`).
- **Contacts select mode:** checkboxes hidden until user clicks **Select** in the title row; bulk actions in `BulkActionRoundBar`; quick context panel may stay open while selecting.

**Example:**

```tsx
import { CHECKBOX_CLASS, CHECKBOX_SM_CLASS } from '@/core/ui/checkboxStyles';

<input
  type="checkbox"
  className={cn(CHECKBOX_CLASS, CHECKBOX_SM_CLASS)}
  ...
/>
```

### Form controls — mobile font size (iOS zoom)

On viewports below Tailwind `md` (≤767px), text `input` / `textarea` / `select` use **16px** so iOS Safari does not zoom the page on focus. Enforced in `client/src/index.css` (`font-size: 16px !important` for those controls). Shared components (`Input`, `Textarea`, `NativeSelect`, `PasswordInput`) use `text-base md:text-sm`. Do **not** fix zoom with `maximum-scale` / `user-scalable=no` on the viewport meta. Checkbox / radio / file / color / button-like inputs are excluded from the CSS rule.

### Table Interaction

- **Row Hover:** `hover:bg-slate-50 dark:hover:bg-slate-900/80`
- **Click Target:** Entire row should be clickable (except checkbox/actions).
- **Cursor:** `cursor-pointer` on row.

### Bulk Action Bar Placement (Strict)

**Card-column lists (Tasks, Notes, …):** use `ListToolbar` — select-all lives on the idle search/sort row; when `selectedCount > 0` (or `selectionMode`), bulk actions replace that row in the same container (search/sort/columns hidden). Do not render a second select/bulk strip under the search bar.

**Canonical list header:** select/bulk in the list **page header** (`RoundExpandableSearch`, Select/Clear, `BulkActionRoundBar`, `ListColumnLayoutToggle` **3|table**). Do not mount `ListToolbar` for CRUD bulk.

**Legacy table/grid lists:** The `BulkActionBar` component must **always** be placed **above** the list/table, outside the Card container:

- **Fitts' Law:** Placing actions near the selection controls (checkboxes in table header) reduces mouse movement.
- **Proximity Principle:** Related controls should be visually grouped together.
- **Industry Standard:** Gmail, Outlook, Salesforce, and most enterprise applications use this pattern.
- **Sticky Toolbar:** Enables the action bar to remain visible when scrolling long lists.

**Correct Pattern (legacy table lists):**

```tsx
<div className="space-y-4">
  {/* BulkActionBar OUTSIDE and ABOVE the Card */}
  <BulkActionBar
    selectedCount={selectedCount}
    onClearSelection={clearSelection}
    actions={[...]}
  />

  <Card>
    <Table>...</Table>
  </Card>
</div>
```

**Incorrect Pattern (DO NOT USE):**

```tsx
<Card>
  <Table>...</Table>
  {/* ❌ WRONG: BulkActionBar inside Card, below table */}
  <div className="p-4 border-t">
    <BulkActionBar ... />
  </div>
</Card>
```

## 2. Grid Views (Cards)

### Card Layout

All grid cards must use `DetailCard` or `Card` with standardized padding.

- **Padding:** `p-5` (standard) or `padding="sm"` on `DetailCard`.
- **Active Plugin Context:** Apply the plugin's semantic class to the container (e.g., `plugin-notes`).
- **Hover State:** `hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md`
- **Selection Ring:** `bg-plugin-subtle ring-1 ring-plugin-subtle/50 border-plugin-subtle`

### Typography & Content

- **Title:** `font-semibold text-gray-900 dark:text-gray-100`
- **Secondary Text:** `text-sm text-gray-500 dark:text-gray-400`
- **Metadata Footer:** Use `text-[10px] text-muted-foreground` for dates and IDs.

**Example Footer:**

```tsx
<div className="mt-4 flex items-center justify-between text-[10px] text-muted-foreground pt-4 border-t border-gray-100 dark:border-gray-800">
  <div className="flex items-center gap-1">
    <Clock className="w-3 h-3" />
    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
  </div>
  <div className="font-mono">#{item.id}</div>
</div>
```

## 3. Detail Panels

Detail panel chrome for plugins (quick context, full view, view/edit sync, QuickActions colors, ConfirmDialog / DuplicateDialog / BulkDeleteModal) is specified in **[`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md)** — **mandatory** for new and aligned CRUD plugins. This section keeps layout tokens; the view guide owns the end-to-end checklist.

### App right sidebar (`AppRightSidebar`)

- Desktop only (`hidden lg:flex`). Collapsed ~40px / expanded ~280px; default **closed**.
- Sections when expanded: widgets (from `getTopBarWidgets()`), Settings category shortcuts (`openSettingsPanel`), plugin details slot (`#right-sidebar-plugin-slot`, ref-driven portal target).
- Phone/pad: rail not shown; detail third column remains inside `DetailLayout`.
- **Limits:** widgets unavailable on phone/pad; Settings shortcuts close other open detail panels; Form `sidebar` content also portals when the rail is open (same `DetailLayout` path as View).

### Layout (`DetailLayout`)

- **Add/create (no sidebar):** single-column grid — form fills full panel width.
- **Edit/view with sidebar (rail closed or phone/pad):** two columns on lg (`main` + `320px` sidebar); main column may use `PANEL_MAX_WIDTH` (`max-w-[920px]`). Plugins often pass an explicit `gridClassName` (e.g. three-col view templates).
- **Edit/view with sidebar (desktop + rail open):** `sidebar` is portaled into `AppRightSidebar`; detail grid drops the third column (see `detailLayoutPortal.ts`). Plugin props unchanged.
- **Three columns:** optional `rightSidebar` (e.g. activity log) — `lg:grid-cols-[1fr_280px_280px]` when not preferring portal.

Reference: contacts and AI Providers edit forms (information sidebar); ingest aligned to same pattern (2026-07-17).

### Header vs. Footer Actions

- **Header (Toolbar):** Place "Tool" actions here.
  - _Examples:_ Export, Duplicate, "Convert to Task", Print.
  - _Logic:_ Secondary actions that produce _new_ outputs or formats.
- **Footer (Sticky):** Place "State" actions here.
  - _Examples:_ Save, Cancel, Open for Edit, Close, Delete.
  - _Logic:_ Primary actions that affect the _current_ state of the view.

### Metadata Section

In the `View` component, the "Information" section (System ID, Dates) should use a standard 3-column grid.

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
  <div>
    <div className="text-xs text-muted-foreground">System ID</div>
    <div className="text-sm font-medium font-mono">...</div>
  </div>
  {/* Created At / Updated At */}
</div>
```

### 3.1 List toolbar buttons

List views place toolbar actions inside the main list card (same shell as table/grid content). All toolbar actions (Settings, Grid, List, Import, etc.) must use the same button style for consistency:

- **Component:** `Button` from `@/components/ui/button`.
- **Variant:** `variant="secondary"` for secondary actions.
- **Size:** `size="sm"`, `className="h-9 text-xs px-3"`.
- **Icon + label:** Use the `icon` prop (e.g. `icon={Settings}`) and put the label as children (e.g. `Settings`). Do not use icon-only buttons for primary toolbar actions like Settings—use the same style as in Files, Contacts, and Mail.

### 3.2 Plugin settings

**Full-page settings (all plugins with `*SettingsView`):** Settings open on the list route via `*ContentView === 'settings'`. Use shared `PluginSettingsPageShell` (`client/src/core/ui/PluginSettingsPageShell.tsx`) so layout matches Core Settings:

- **Header:** Title (`text-xl font-semibold tracking-tight`) + subtitle (`text-sm text-muted-foreground`) — **`hidden md:flex`** (phone-hidden; Close/Save live in the mobile bottom bar). Trailing: green header **Save** when dirty (`SettingsHeaderSaveButton`), then **Close**. Do not place category tab buttons next to Close.
- **Category picker (≥1 categories):** round header buttons (`RoundIconLabelButton` soft/primary) via `PluginSettingsPageShell` — same pattern with a single category (e.g. Tasks Import-only). Canonical icons from `SETTINGS_CATEGORY_ICONS` (`client/src/core/ui/settingsCategoryIcons.ts`): `import`→Upload, `tags`/`categories`→Tag, `api`→Settings2, `production`→Timer, `sources`→BookOpen. Do **not** use a settings **View** tab for cards/table — list layout is controlled from the list header (`ListColumnLayoutToggle`).
- **Body:** Default wrap in `DETAIL_VIEW_CARD_CLASS` + `p-4` + `DetailSection`. Multi-card bodies (e.g. Teams, Schedule) set `wrapContentInCard={false}` and apply `DETAIL_VIEW_CARD_CLASS` per card.
- **List layout preference:** Cards | table is controlled from the list header (`ListColumnLayoutToggle`), not from a settings View tab. Persist via plugin settings/session as today.
- **Icons:** When category cards are present, DetailSection titles are **text-only** (no `icon` prop — avoid duplicating the category metaphor). Single-pane settings (Mail, Pulses, Files, Teams, Requests, Schedule, Estimates) may use DetailSection `icon=` (boxed `h-7` / glyph `h-3.5`) for distinct sections — never inline Lucide glyphs inside the title node. Action buttons keep semantic icons (Check, Plus, Download, Upload, etc.) via Button `icon` prop (`h-4 w-4`).
- No bottom dirty-Save footer for plugins that use dirty-state Save; that Save lives in the header like Core Settings. No `panelMode === 'settings'` in the detail `Form` for plugins that use full-page settings.
- **Save variants (verified):** Dirty header Save — tasks, notes, contacts, slots, matches, cups, instructions, teams (season), estimates, mail, pulses. Per-section / immediate save in children — guides, requests, schedule, files (cloud credentials).

**Panel settings (legacy):** When a plugin still opens settings in the detail panel:

- **Content:** Use `DetailSection` to group settings (e.g. "Cloud storage", "Email provider").
- **Header/Footer actions:** `PanelFooter` for non-core plugins in `settings` mode shows **Close only**; the settings form is expected to save inline (or via its own controls). Core `settings` plugin footer shows Close + Save. See `PanelFooter.tsx` and `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §7.
- **Core behaviour:** If the plugin’s Form component returns early when `panelMode === 'settings'` (and therefore does not register submit/cancel event listeners), core panel handlers must close the panel for that plugin when in `settings` mode by calling the context’s close function directly. See `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §7 (Plugin settings page).

**Core Settings (Preferences / Account profile / Team / Activity Log):** Same page shell as Contacts list — `contentFlush`, `min-h-full bg-background px-6 py-4`, `space-y-4`, in-page title (no ContentHeader). Category picker uses `SettingsCategoryCard` (same component as plugin settings) in a `gap-3` grid with a short description under each label.

- **Account profile** (`category: 'profile'`): shared account identity only — Account name, Contact (**Website**, **Email**, **Phone**), Logo, Address, Billing (incl. **Swish number**, **Approved for F-tax**, **Late payment interest %** used on invoices). No personal member fields.
- **Team**: signed-in user’s **Your profile** (name, title, email via user `profile` settings) plus members/roles roster.
- Shared org fields live on main DB `tenants.organization` (`GET/PUT /api/organization`; read: all tenant roles; write: admin/editor). Field labels use `DETAIL_FIELD_LABEL_CLASS`. Account profile and Team render their own `DETAIL_VIEW_CARD_CLASS` stacks (no outer single card wrapper).

**Sidebar account footer:** Desktop and mobile nav show a compact strip (`SidebarAccountFooter`) at the bottom when org data exists: org.nr, address lines, website link (`target=_blank` + `noopener noreferrer`), mailto email, Swish. Text is `text-[10px]` muted; horizontal inset aligns with nav item content (`px-6`); no top border; bottom padding `pb-6`. Data comes from AppContext `organizationProfile` (loaded via `organizationApi.getOrganization` / `refreshOrganization`).

**Detail Form = Detail View chrome:** Plugin create/edit forms that use `DetailLayout` must match view mode: no extra outer padding / `md:-mx-6` bleed shell, no `PANEL_MAX_WIDTH` on the main column, cards use `DETAIL_VIEW_CARD_CLASS`. Content sits in DetailPanel’s outer inset (`px-2 sm:px-3` phone, `px-6` pad/desktop — same as list pages) with `pb-4` (same as view).

## 4. Typography Scale

- **Headings:** `text-2xl font-extrabold tracking-tight` (list + detail page headers; shared `PLUGIN_PAGE_TITLE_CLASS` in `@/core/ui/pluginPageStyles`)
- **Subheadings:** `text-sm font-medium text-gray-900`
- **Body:** `text-sm text-gray-600`
- **Labels:** `text-xs text-muted-foreground`
- **Micro-copy:** `text-[10px] text-muted-foreground` (Footers, IDs)
- **App font:** Mulish (self-hosted; `client/src/core/styles/mulish.css`)

### 4.0 Round icon-label buttons

Primary action pattern for dialogs, bulk bars, and quick context chrome.

- **Component:** `RoundIconLabelButton` (`@/components/ui/round-icon-label-button.tsx`); alias `ExpandableIconButton` for legacy imports.
- **Variants:** `primary` (blue), `secondary` (gray), `success` (green), `danger` (red).
- **Expansion:** `alwaysExpanded` — icon + label always visible (dialog Save/Close, bulk pills). Default collapsed — icon-only; label on hover unless `expandOnHover={false}` (e.g. quick context Close, prev/next chevrons).
- **Dialog wrappers:** `DialogRoundButtons`, `AlertDialogRound*` (`@/core/ui/DialogRoundButtons.tsx`).
- **Quick context:** `QuickContextHeaderActions` + `QuickContextOpenFullFooter` (`@/core/ui/QuickContextHeaderActions.tsx`) — reuse in all `*QuickContextPanel` headers/footers; do not duplicate ghost icon buttons.
- **Bulk (Contacts reference):** `BulkActionRoundBar` — blue count pill + gray `secondary` action pills (`alwaysExpanded`). Icon/label color via `contentClassName` or `tone: 'destructive'`: message `text-sky-500`, email `text-red-800`, delete `text-red-600` (default destructive tone).
- **Prev/next:** `ItemNavigation` — secondary round chevrons + gray count pill (`h-11`).

### 4.0.1 Dialog chrome (modals / popups)

Shared layout tokens in `@/core/ui/dialogStyles.ts`; title component in `@/core/ui/DialogHeading.tsx`.

- **Title:** `DialogHeading` + `DIALOG_TITLE_CLASS` (`text-xl font-extrabold text-foreground`).
- **Subtitle:** `DIALOG_SUBTITLE_CLASS` (`mt-1 text-xs text-muted-foreground`).
- **Regions:** `DIALOG_HEADER_CLASS`, `DIALOG_BODY_CLASS` / `DIALOG_BODY_SCROLL_CLASS`, `DIALOG_FOOTER_CLASS` (right-aligned actions, `gap-3`), optional `DIALOG_FOOTER_SPLIT_CLASS`.
- **Actions:** `DialogRoundButtons` / `AlertDialogRound*` — `RoundIconLabelButton` with `alwaysExpanded`; wrap Radix actions with `asChild` (e.g. `AlertDialogCancel asChild` → `DialogCloseButton`).
- **Consumers:** `ConfirmDialog`, `DuplicateDialog`, `BulkDeleteModal`, `BulkMessageDialog`, `BulkEmailDialog`, custom plugin modals — use tokens instead of ad-hoc padding/title classes.

### 4.1 Properties cards (Detail + Edit)

When a plugin uses the "properties card" pattern (slots-style), use these tokens consistently:

- **Section header row:** icon container `h-7 w-7`, title `text-sm font-semibold`.
- **Property row shell:** `rounded-lg border border-border p-4`.
- **Property label:** `text-sm font-medium`.
- **Property control:** `h-9` with `text-xs` content.
- **Helper/meta text inside row:** `text-[11px] text-muted-foreground`.

Do not mix compact legacy values (`text-[10px]`, `h-7`, narrow triggers) in the same properties area when reference uses the standard above.

### 4.2 Date and time picker visual parity

If a form has both date and time fields in the same semantic group:

- Date and time triggers must share the same visual shell (height, border, bg, icon alignment, hover/disabled states).
- Prefer popover-based interaction for both if one of them already uses popover.
- Include clear/reset affordance where reference includes it.

## 5. Semantic Plugin Colors

To ensure a consistent visual identity, each plugin has a dedicated color theme defined in `index.css`.

### Global Utility Classes

- `.plugin-[name]`: Sets the current plugin context (e.g., `plugin-tasks`).
- `.bg-plugin-subtle`: A translucent background using the plugin color.
- `.border-plugin-subtle`: A translucent border using the plugin color.
- `.text-plugin`: Solid text in the plugin color.

### Plugin Color Palette

| Plugin    | Variable             | Color  | Example Class       |
| --------- | -------------------- | ------ | ------------------- |
| Notes     | `--plugin-notes`     | Amber  | `.plugin-notes`     |
| Contacts  | `--plugin-contacts`  | Blue   | `.plugin-contacts`  |
| Tasks     | `--plugin-tasks`     | Purple | `.plugin-tasks`     |
| Estimates | `--plugin-estimates` | Cyan   | `.plugin-estimates` |
| Invoices  | `--plugin-invoices`  | Green  | `.plugin-invoices`  |
| Files     | `--plugin-files`     | Slate  | `.plugin-files`     |
| Mail      | `--plugin-mail`      | Rose   | `.plugin-mail`      |
| Guides    | `--plugin-guides`    | Teal   | `.plugin-guides`    |

### Implementation Pattern

```tsx
<Card
  className={cn(
    'relative p-5 transition-all',
    isSelected
      ? 'plugin-tasks bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50'
      : 'hover:border-plugin-subtle hover:plugin-tasks hover:shadow-md',
  )}
>
  <h3 className="text-plugin font-semibold">Task Title</h3>
</Card>
```

## Verification note

This document has been verified against the current implementation (DetailLayout, DetailCard, Sidebar, Dashboard, BulkActionBar, list/grid patterns). When making layout or design changes, update this document so it stays the single source of truth for UI/UX standards.
