# Homebase UI & UX Standards (V3 Premium)

**Last Updated:** February 2026  
**Applies to:** Homebase 3.1 (and V3 Premium). Plugin semantic colors are defined in `client/src/index.css`.

This document defines the strict UI/UX standards for the Homebase V3 "Premium" design language. All plugins must adhere to these guidelines to ensure a cohesive user experience.

---

## 1. Button Sizes

### Compact buttons (`size="sm"`)

Use `size="sm"` for compact areas: panel footer, content toolbar, bulk action bar. This maps to `h-9 px-3 rounded-md`.

- **Panel footer:** Delete, Duplicate, Export, Close, Edit
- **ContentToolbar rightActions:** Grid, List, Import, Settings
- **BulkActionBar action buttons:** Export CSV, Export PDF, Delete

```tsx
<Button size="sm" icon={Grid3x3} variant="secondary">Grid</Button>
```

---

## 2. List Views (Tables)

### Single Card wrapper (recommended)

Use **one** Card with `className="shadow-none"` for the entire list content (empty state, grid, or table). Avoid nested outer+inner Cards for better stability across viewports.

```tsx
<Card className="shadow-none">
  {empty ? (
    <div className="p-6 text-center text-muted-foreground">...</div>
  ) : viewMode === 'grid' ? (
    <div className="grid ...">...</div>
  ) : (
    <Table>
      <TableHeader>...</TableHeader>
      <TableBody>...</TableBody>
    </Table>
  )}
</Card>
```

### Checkbox Standardization (Strict)

- **Use native `<input type="checkbox">`** — NOT the shadcn `Checkbox` component.
- **Column Width:** `className="w-12"` on `TableHead` and `TableCell`.
- **Input Styling:** `className="h-4 w-4 cursor-pointer"`.

```tsx
// Header (select all)
<TableHead className="w-12">
  <input
    type="checkbox"
    checked={allSelected}
    onChange={toggleSelectAll}
    className="h-4 w-4 cursor-pointer"
    aria-label={allSelected ? 'Deselect all' : 'Select all'}
  />
</TableHead>

// Cell
<TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
  <input
    type="checkbox"
    checked={selectedIds.has(item.id)}
    onChange={() => toggleSelectOne(item.id)}
    className="h-4 w-4 cursor-pointer"
    aria-label={`Select ${item.name}`}
  />
</TableCell>
```

### Table Interaction

- **Row Hover:** `hover:bg-gray-50 dark:hover:bg-gray-900/50`
- **Click Target:** Entire row clickable (except checkbox/actions).
- **Cursor:** `cursor-pointer` on row.

## 3. BulkActionBar (Checkbox Selection)

When users select items with checkboxes, show `BulkActionBar` above the list/grid. Use from `@/core/ui/BulkActionBar`.

### Layout

- **Left:** Badge `{selectedCount} selected` (blue pill) + "Clear selection" link.
- **Right:** Action buttons with `size="sm"`, `variant="outline"` or `variant="destructive"` for delete.

### Badge & link styling

- Badge: `px-2 py-1.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200`
- Link: `variant="link"`, blue, underlined.

### Standard bulk actions (e.g. Contacts)

- **Export CSV** (icon: FileSpreadsheet, variant: default)
- **Export PDF** (icon: FileText, variant: default)
- **Delete…** (icon: Trash2, variant: destructive)

```tsx
<BulkActionBar
  selectedCount={selectedCount}
  onClearSelection={clearSelection}
  actions={[
    { label: 'Export CSV', icon: FileSpreadsheet, onClick: handleExportCSV, variant: 'default' },
    { label: 'Export PDF', icon: FileText, onClick: handleExportPDF, variant: 'default' },
    { label: 'Delete…', icon: Trash2, onClick: () => setShowBulkDeleteModal(true), variant: 'destructive' },
  ]}
/>
```

---

## 4. Grid Views (Cards)

### Card Layout

All grid cards must use `DetailCard` or `Card` with standardized padding.

- **Padding:** `p-5` (standard) or `padding="sm"` on `DetailCard`.
- **Active Plugin Context:** Apply the plugin's semantic class to the container (e.g., `plugin-notes`).
- **Hover State:** `hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md`
- **Selection Ring:** `bg-plugin-subtle ring-1 ring-plugin-subtle/50 border-plugin-subtle`

### Grid checkbox

Use native `<input type="checkbox">` with `className="h-4 w-4 cursor-pointer"`, same as table checkboxes. Place in card header next to ID/number.

```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={isSelected}
    onChange={() => toggleSelectOne(item.id)}
    onClick={(e) => e.stopPropagation()}
    className="cursor-pointer h-4 w-4"
    aria-label={isSelected ? 'Unselect' : 'Select'}
  />
  <span className="font-mono text-[10px] text-muted-foreground">#{item.id}</span>
</div>
```

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

## 5. Detail Panel Footer (PanelFooter)

### View mode layout

- **Left side:** Delete, Duplicate (if plugin supports), `detailFooterActions`, Export TXT/CSV/PDF.
- **Right side:** Close, Edit. Optionally: green Update (e.g. Tasks quick-edit, Contacts tags).
- **All buttons:** `size="sm"` (compact).

### Plugin context requirements

For the footer to show export buttons, the plugin context must expose:

- `exportFormats`: `['txt', 'csv', 'pdf']` (or subset)
- `onExportItem`: `(format: ExportFormat, item: T) => void`

For extra left-side actions (e.g. "To Task"):

- `detailFooterActions`: `Array<{ id: string; label: string; icon: ComponentType; onClick: (item) => void; className?: string }>`

### Export config (single-item export)

Create a config file (e.g. `plugins/contacts/utils/contactExportConfig.ts`) and implement:

- `contactToTxtContent`, `contactToCsvRow`, `contactToPdfRow` (or equivalent)
- `getContactExportBaseFilename`
- `contactExportConfig`: `ExportFormatConfig` with `txt`, `csv`, `pdf` builders

```tsx
// In plugin context value
exportFormats: ['txt', 'csv', 'pdf'],
onExportItem: useCallback((format, item) => {
  exportItems({
    items: [item],
    format,
    config: contactExportConfig,
    filename: getContactExportBaseFilename(item),
    title: 'Contacts Export',
  });
}, []),
```

### Duplicate

- Contacts: **no** Duplicate in footer.
- Other plugins: show Duplicate if `getDuplicateConfig(currentItem)` returns config.

---

## 6. Detail Panel Content

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

### Header vs. Footer (mental model)

- **Header (Toolbar):** Tool actions — Export, Duplicate, "Convert to Task", Print.
- **Footer (Sticky):** State actions — Save, Cancel, Close, Edit, Delete.

---

## 7. ContentToolbar (Header)

Use `ContentToolbar` in the content header (via `setHeaderTrailing`). Search + rightActions.

- **rightActions buttons:** `size="sm"`, `variant="secondary"` or `variant="default"` for active.
- **Examples:** Grid, List, Import, Settings.

```tsx
<ContentToolbar
  searchValue={searchTerm}
  onSearchChange={setSearchTerm}
  searchPlaceholder="Search..."
  rightActions={
    <div className="flex gap-2">
      <Button variant={viewMode === 'grid' ? 'default' : 'secondary'} size="sm" icon={Grid3x3}>Grid</Button>
      <Button variant={viewMode === 'list' ? 'default' : 'secondary'} size="sm" icon={ListIcon}>List</Button>
      <Button variant="secondary" size="sm" icon={Upload}>Import</Button>
    </div>
  }
/>
```

---

## 8. Typography Scale

- **Headings:** `text-lg font-semibold` (Panel Titles)
- **Subheadings:** `text-sm font-medium text-gray-900`
- **Body:** `text-sm text-gray-600`
- **Labels:** `text-xs text-muted-foreground`
- **Micro-copy:** `text-[10px] text-muted-foreground` (Footers, IDs)

---

## 9. Semantic Plugin Colors

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

---

## 10. Implementation Checklist (per plugin)

When adding or aligning a plugin to these standards:

- [ ] **List view:** Single `<Card className="shadow-none">` wrapping empty/grid/table content; native `<input type="checkbox">`, `w-12` column, `h-4 w-4 cursor-pointer`
- [ ] **Grid view:** Same checkbox, plugin semantic classes, selection ring
- [ ] **BulkActionBar:** Export CSV, Export PDF, Delete… with `size="sm"`
- [ ] **ContentToolbar:** Search + rightActions (Grid, List, Import etc.) with `size="sm"`
- [ ] **Detail footer:** Plugin context provides `exportFormats` and `onExportItem` if export supported
- [ ] **Export config:** Create `utils/[plugin]ExportConfig.ts` with txt/csv/pdf builders
- [ ] **Buttons:** Use `size="sm"` in footer, toolbar, bulk bar

---

## Verification note

This document has been verified and applied across Homebase 3.1: list views use single `Card className="shadow-none"` (Contacts, Notes, Tasks, Estimates, Invoices, Products, Files, Orders, Channels, Inspection, Mail), detail panels (metadata 3-col grid, typography), grid cards, bulk action bar, panel footer, and plugin semantic colors in `client/src/index.css`. When making layout or design changes, update this document so it stays the single source of truth for UI/UX standards.
