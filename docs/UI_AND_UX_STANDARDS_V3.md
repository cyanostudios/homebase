# Homebase UI & UX Standards (V3 Premium)

**Last Updated:** August 2026

This document defines the strict UI/UX standards for the Homebase V3 "Premium" design language. All plugins must adhere to these guidelines to ensure a cohesive user experience.

## 0. V3.6 Shared UI Primitives

The v3.6 alignment introduced shared primitive behavior that all plugins should rely on instead of local workarounds:

- **`Card` primitive:** `shadow-none` also implies `border-0` (see `client/src/components/ui/card.tsx`).
- **`Table` primitive:** use `rowBorders={false}` for borderless list tables; it clears borders consistently for `thead/tbody/tr/th/td` (see `client/src/components/ui/table.tsx`).
- **`ContentHeader` suffix:** status badges or contextual suffix UI should use `titleSuffix` via layout context (`MainLayout` / `ContentHeader`) instead of ad-hoc title hacks.
- **Detail view tokens:** reuse `client/src/core/ui/detailViewCardStyles.ts` (`DETAIL_VIEW_CARD_CLASS`, `DETAIL_FIELD_LABEL_CLASS`, `DETAIL_NOTE_CALLOUT_CLASS`, `DETAIL_ENTITY_LINK_TRIGGER_CLASS` for ExternalLink + label Open controls — same underline / primary-hover language as list Select all, `DETAIL_LIST_ITEM_HOVER_CLASS` / `DETAIL_LIST_ITEM_TITLE_CLASS`, etc.) and related helpers in `DetailSection`.
- **Shell content flush:** `ContentSurface` sits flush against the sidebar and top bar (`m-0`, `rounded-none`, `bg-card`). List and detail share `MAIN_CONTENT_SHELL_CLASS` (`rounded-xl bg-background`) so both use the same gray main surface and corner inset. `MainLayout` main uses `pt-14` + `md:pl-[252px]` and a light right gutter (`md:pr-4`). Internal list/detail padding (`p-4 md:p-6` / `flush`) is unchanged.

### 0.1 List view shell (contacts-style, rolled out 2026-04; card columns 2026-07)

All plugin list views should match this shell. **Settings** is excluded (not a data list).

**Card-column list (rolled out 2026-07-24)** — reference for **Tasks, Contacts, Notes, Guides, Requests, Slots, Estimates, Matches, Files, Ingest, Cups, Teams**:

| Element          | Standard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Layout**       | No Grid/List toggle; no list `Table`. CSS grid of `*ListItem` cards using `DETAIL_VIEW_CARD_CLASS` (Teams may keep domain `TeamCard` visuals).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Columns**      | Toolbar buttons **1 / 2 / 3** set `columnCount` (full / half / third from `sm`; one column below `sm`). Persist `columnCount` (settings and/or session); migrate legacy `viewMode` grid→3, list→1.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Sort**         | Single toolbar sort field (`w-[140px]`) + shared asc/desc toggle. Per-plugin `*ListSort.ts` / `compare*ByField`. Sort fields cover list meta (not only title/dates); client-only, not persisted. Known limits: Contacts `tags` = first tag; Notes `mentions` / Guides `languages` = count.                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Filter stats** | `ListFilterStatCard` (`@/core/ui/ListFilterStatCard`): label+dot left, value right; `px-6 py-4` / `text-3xl`. Hover `bg-primary/10` + `text-primary`. Grid `gap-2`. Compact secondary chips (Teams gender, Requests types, Schedule teams): `LIST_FILTER_CHIP_CLASS` / `_ACTIVE` — select-sm. Large chips (Teams detail tabs Overview/Schedule): `LIST_FILTER_CHIP_LG_*` — same underline language, larger padding (`select-lg`). Dashboard widgets: `DASHBOARD_WIDGET_CARD_CLASS` + Open via `LIST_FILTER_CHIP_CLASS`.                                                                                                                                                                                                                              |
| **Rhythm**       | `space-y-3` / `gap-3` between filter stats, unified `ListToolbar`, items, footer (`gap-2` within the filter-stat grid). List page surface uses `bg-background` (light token `210 20% 96%`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Row content**  | Badges top-left; optional compact status control top-right when the entity has status; bold title; optional plain excerpt; meta row. When toolbar `columnCount === 1`, meta sits on the top row with badges; for 2/3 columns meta stays below title/excerpt (Tasks, Contacts, Notes, Requests, Estimates, Matches, Guides, Slots, Files, Ingest, Cups, Teams). List card hover: `DETAIL_LIST_ITEM_HOVER_CLASS` (`hover:bg-primary/10`); title uses `DETAIL_LIST_ITEM_TITLE_CLASS` (`group-hover:text-primary`) like filter chips. Teams `TeamCard`: no colored top stripe. Contacts: assignable indicator = small green/red dot (top-right; green = assignable, red = not). Estimates: status via compact dropdown only (no duplicate status badge). |
| **List toolbar** | Shared `ListToolbar` (`@/core/ui/ListToolbar`): one row. Idle (`selectedCount === 0`): **Select all** + optional **Quick task/note/request** (`leadingActions`, left); search beside sort + column **1/2/3** (right). Quick-add open: form takes the whole row (`quickAddOpen` / `quickAddExpanded`; full-width input at normal control height `h-9`). Selection (`selectedCount > 0`): bulk actions replace that row (search/sort/columns hidden). Plugins with toolbar quick-add: Tasks, Notes, Requests (`*QuickAdd` + `layout="toolbar"`).                                                                                                                                                                                                       |
| **List footer**  | Shared `ListFooterBar`: transparent surface (no white card); “Showing X of Y” left-aligned. Optional `leading` reserved; Tasks/Notes/Requests quick-add lives in the toolbar, not the footer or grid.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Empty state**  | Shared `ListEmptyState` (`@/core/ui/ListEmptyState`): muted card + short copy (`No X yet` / `*.noYet`). When the list is **truly empty** (no search/filter), show a primary **Create** button under the text that calls the same open-create handler as header Add (`attemptNavigation(() => openXPanel(null))`). When results are empty due to search/filter (“no match”), show match copy only — **no** Create button. Do not embed “Click Add…” prose in `noYet`; the button replaces that hint. Reference: instructions list; golden template `YourItemList.tsx`.                                                                                                                                                                                |
| **Bulk actions** | Plugin-specific actions in `ListToolbar` `bulkActions` when selecting. Neutral actions: hover `bg-primary/10` + `text-primary`. Clear selection matches Delete red hover.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Bulk status**  | Where the entity has a status/lifecycle field (Tasks, Guides, Requests): bulk **Status** action → `*BulkStatusDialog` (sequential updates). Contacts: bulk **Assignable** → `ContactBulkAssignableDialog` (Yes/No; sequential `PUT` with full contact payload, same class as bulk tags). Contacts/Notes/Slots/Cups: no lifecycle-status bulk (Slots/Cups keep BulkProperties).                                                                                                                                                                                                                                                                                                                                                                       |

**Legacy table/grid shell** (still applies to plugins not yet migrated, e.g. invoices, mail, pulses, ai-providers, schedule):

| Element              | Standard                                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Panel surface**    | `overflow-hidden rounded-xl border-0 bg-white shadow-sm dark:bg-slate-950`                                                                               |
| **Toolbar**          | Search + settings + grid/list in the **same** panel top row as the list                                                                                  |
| **Grid/list toggle** | Wrapper: `inline-flex items-center rounded-md border border-border/30 bg-muted/40 p-0.5`; buttons: `h-7 rounded-[6px] px-2 text-xs` + clear active state |
| **Table**            | `rowBorders={false}`; header `bg-slate-50/90 dark:bg-slate-900/50`                                                                                       |
| **Grid cards**       | `rounded-xl border-0 … shadow-sm`                                                                                                                        |
| **Badges**           | `border-0 rounded-md px-2 py-0.5 text-xs font-semibold`; subtle fill, not outline                                                                        |

**Additional reference implementations (2026-06):**

- **Grid cards:** `TeamCard` (`client/src/plugins/teams/components/TeamCard.tsx`) — age/color avatar, status badge, player/series counts; next training and/or next match meta; optional break-return countdown (red when &lt; 7 days to ongoing season-break `endDate`). No colored top stripe.
- **Time grid:** `ScheduleTimeGrid` (`client/src/plugins/schedule/components/ScheduleTimeGrid.tsx`) — week grid with drag/drop training slots.

## 1. List Views (Tables)

### Checkbox Standardization (Strict)

To prevent layout shifts when switching tabs, all list views must follow these exact specifications:

- **Column Width:** The checkbox column `TableHead` and `TableCell` must essentially have `className="w-12"`.
- **Input Styling:** All checkbox inputs must use `className="h-4 w-4 cursor-pointer"`.

**Example:**

```tsx
// Header
<TableHead className="w-12">
  <input type="checkbox" className="h-4 w-4 cursor-pointer" ... />
</TableHead>

// Cell
<TableCell className="w-12">
  <input type="checkbox" className="h-4 w-4 cursor-pointer" ... />
</TableCell>
```

### Table Interaction

- **Row Hover:** `hover:bg-slate-50 dark:hover:bg-slate-900/80`
- **Click Target:** Entire row should be clickable (except checkbox/actions).
- **Cursor:** `cursor-pointer` on row.

### Bulk Action Bar Placement (Strict)

**Card-column lists (Tasks, Contacts, Notes, …):** use `ListToolbar` — select-all lives on the idle search/sort row; when `selectedCount > 0`, bulk actions replace that row in the same container (search/sort/columns hidden). Do not render a second select/bulk strip under the search bar.

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

### Layout (`DetailLayout`)

- **Add/create (no sidebar):** single-column grid — form fills full panel width.
- **Edit/view with sidebar:** two columns on lg (`main` + `320px` sidebar); main column may use `PANEL_MAX_WIDTH` (`max-w-[920px]`).
- **Three columns:** optional `rightSidebar` (e.g. activity log) — `lg:grid-cols-[1fr_280px_280px]`.

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

- **Header:** Title (`text-xl font-semibold tracking-tight`) + subtitle (`text-sm text-muted-foreground`). Trailing: green header **Save** when dirty (`SettingsHeaderSaveButton`), then **Close** alone (passed as `trailing` / `inlineTrailing`). Do not place category tab buttons next to Close.
- **Category picker (≥2 categories):** `SettingsCategoryCard` grid (`grid-cols-2`, `md:grid-cols-N` up to 4) — same surface language as Core Settings / `ListFilterStatCard` (dot + uppercase label + icon + short description). Active: `ring-1 ring-border/70`. Use canonical icons from `SETTINGS_CATEGORY_ICONS` (`client/src/core/ui/settingsCategoryIcons.ts`): `view`→LayoutGrid, `import`→Upload, `tags`/`categories`→Tag, `api`→Settings2, `production`→Timer, `sources`→BookOpen. Category card glyph size: `h-5 w-5`.
- **Body:** Default wrap in `DETAIL_VIEW_CARD_CLASS` + `p-4` + `DetailSection`. Multi-card bodies (e.g. Teams, Schedule) set `wrapContentInCard={false}` and apply `DETAIL_VIEW_CARD_CLASS` per card.
- **Icons:** When category cards are present, DetailSection titles are **text-only** (no `icon` prop — avoid duplicating the category metaphor). Single-pane settings (Mail, Pulses, Files, Teams, Requests, Schedule, Estimates) may use DetailSection `icon=` (boxed `h-7` / glyph `h-3.5`) for distinct sections — never inline Lucide glyphs inside the title node. Action buttons keep semantic icons (Check, Plus, Download, Upload, etc.) via Button `icon` prop (`h-4 w-4`).
- No bottom dirty-Save footer for plugins that use dirty-state Save; that Save lives in the header like Core Settings. No `panelMode === 'settings'` in the detail `Form` for plugins that use full-page settings.
- **Save variants (verified):** Dirty header Save — tasks, notes, contacts, slots, matches, cups, instructions, teams (season), estimates. Per-section / immediate save in children — guides, requests, schedule, files (cloud credentials). **Known gap:** mail and pulses full-page settings expose save via `PanelFormHandle` but do not currently surface a header or inline Save control.

**Panel settings (legacy):** When a plugin still opens settings in the detail panel:

- **Content:** Use `DetailSection` to group settings (e.g. "Cloud storage", "Email provider").
- **Header/Footer actions:** `PanelFooter` for non-core plugins in `settings` mode shows **Close only**; the settings form is expected to save inline (or via its own controls). Core `settings` plugin footer shows Close + Save. See `PanelFooter.tsx` and `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §7.
- **Core behaviour:** If the plugin’s Form component returns early when `panelMode === 'settings'` (and therefore does not register submit/cancel event listeners), core panel handlers must close the panel for that plugin when in `settings` mode by calling the context’s close function directly. See `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §7 (Plugin settings page).

**Core Settings (Preferences / Profile / Team / Activity Log):** Same page shell as Contacts list — `contentFlush`, `min-h-full bg-background px-6 py-4`, `space-y-4`, in-page title (no ContentHeader). Category picker uses `SettingsCategoryCard` (same component as plugin settings) in a `gap-3` grid with a short description under each label. Profile renders multiple `DETAIL_VIEW_CARD_CLASS` sections (Personal + shared Account name / Logo / Address / Billing). Shared org fields live on main DB `tenants.organization` (`GET/PUT /api/organization`). Field labels use `DETAIL_FIELD_LABEL_CLASS`.

**Detail Form = Detail View chrome:** Plugin create/edit forms that use `DetailLayout` must match view mode: no extra outer padding / `md:-mx-6` bleed shell, no `PANEL_MAX_WIDTH` on the main column, cards use `DETAIL_VIEW_CARD_CLASS`. Content sits in DetailPanel’s `px-6 py-4` (same as view).

## 4. Typography Scale

- **Headings:** `text-lg font-semibold` (Panel Titles)
- **Subheadings:** `text-sm font-medium text-gray-900`
- **Body:** `text-sm text-gray-600`
- **Labels:** `text-xs text-muted-foreground`
- **Micro-copy:** `text-[10px] text-muted-foreground` (Footers, IDs)

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
