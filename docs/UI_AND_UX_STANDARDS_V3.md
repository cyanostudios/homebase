# Homebase UI & UX Standards (V3 Premium)

**Last Updated:** February 2026

This document defines the strict UI/UX standards for the Homebase V3 "Premium" design language. All plugins must adhere to these guidelines to ensure a cohesive user experience.

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

- **Row Hover:** `hover:bg-gray-50 dark:hover:bg-gray-900/50`
- **Click Target:** Entire row should be clickable (except checkbox/actions).
- **Cursor:** `cursor-pointer` on row.

### Bulk Action Bar Placement (Strict)

The `BulkActionBar` component must **always** be placed **above** the list/table, outside the Card container. This is based on UX research and industry best practices:

- **Fitts' Law:** Placing actions near the selection controls (checkboxes in table header) reduces mouse movement.
- **Proximity Principle:** Related controls should be visually grouped together.
- **Industry Standard:** Gmail, Outlook, Salesforce, and most enterprise applications use this pattern.
- **Sticky Toolbar:** Enables the action bar to remain visible when scrolling long lists.

**Correct Pattern:**

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

List views use `ContentToolbar` and set it via `useContentLayout().setHeaderTrailing`. All toolbar actions (Settings, Grid, List, Import, etc.) must use the same button style for consistency:

- **Component:** `Button` from `@/components/ui/button`.
- **Variant:** `variant="secondary"` for secondary actions.
- **Size:** `size="sm"`, `className="h-9 text-xs px-3"`.
- **Icon + label:** Use the `icon` prop (e.g. `icon={Settings}`) and put the label as children (e.g. `Settings`). Do not use icon-only buttons for primary toolbar actions like Settings—use the same style as in Files, Contacts, and Mail.

### 3.2 Plugin settings panel

When a plugin has a settings screen that opens in the detail panel (e.g. Files cloud storage, Mail SMTP):

- **Content:** Use `DetailSection` to group settings (e.g. "Cloud storage", "Email provider").
- **Header/Footer actions:** In form modes (create/edit/settings), the panel uses Close + Save/Update actions with shared behavior. Actions may be rendered in header and/or footer, but the close/save handlers must be the same to keep unsaved-changes behavior consistent.
- **Core behaviour:** If the plugin’s Form component returns early when `panelMode === 'settings'` (and therefore does not register submit/cancel event listeners), core panel handlers must close the panel for that plugin when in `settings` mode by calling the context’s close function directly. See `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §7 (Plugin settings page).

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
