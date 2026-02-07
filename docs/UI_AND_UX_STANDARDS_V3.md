# Homebase UI & UX Standards (V3 Premium)

**Last Updated:** February 2026

This document defines the strict UI/UX standards for the Homebase V3 "Premium" design language. All plugins must adhere to these guidelines to ensure a cohesive user experience.

## 1. List Views (Tables)

### Checkbox Standardization (Strict)
To prevent layout shifts when switching tabs, all list views must follow these exact specifications:

-   **Column Width:** The checkbox column `TableHead` and `TableCell` must essentially have `className="w-12"`.
-   **Input Styling:** All checkbox inputs must use `className="h-4 w-4 cursor-pointer"`.

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
-   **Row Hover:** `hover:bg-gray-50 dark:hover:bg-gray-900/50`
-   **Click Target:** Entire row should be clickable (except checkbox/actions).
-   **Cursor:** `cursor-pointer` on row.

## 2. Grid Views (Cards)

### Card Layout
All grid cards must use `DetailCard` or `Card` with standardized padding.
-   **Padding:** `p-5` (standard) or `padding="sm"` on `DetailCard`.
-   **Active Plugin Context:** Apply the plugin's semantic class to the container (e.g., `plugin-notes`).
-   **Hover State:** `hover:border-plugin-subtle hover:plugin-contacts hover:shadow-md`
-   **Selection Ring:** `bg-plugin-subtle ring-1 ring-plugin-subtle/50 border-plugin-subtle`

### Typography & Content
-   **Title:** `font-semibold text-gray-900 dark:text-gray-100`
-   **Secondary Text:** `text-sm text-gray-500 dark:text-gray-400`
-   **Metadata Footer:** Use `text-[10px] text-muted-foreground` for dates and IDs.

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
-   **Header (Toolbar):** Place "Tool" actions here.
    -   *Examples:* Export, Duplicate, "Convert to Task", Print.
    -   *Logic:* Secondary actions that produce *new* outputs or formats.
-   **Footer (Sticky):** Place "State" actions here.
    -   *Examples:* Save, Cancel, Open for Edit, Close, Delete.
    -   *Logic:* Primary actions that affect the *current* state of the view.

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

## 4. Typography Scale

-   **Headings:** `text-lg font-semibold` (Panel Titles)
-   **Subheadings:** `text-sm font-medium text-gray-900`
-   **Body:** `text-sm text-gray-600`
-   **Labels:** `text-xs text-muted-foreground`
-   **Micro-copy:** `text-[10px] text-muted-foreground` (Footers, IDs)

## 5. Semantic Plugin Colors

To ensure a consistent visual identity, each plugin has a dedicated color theme defined in `index.css`.

### Global Utility Classes
-   `.plugin-[name]`: Sets the current plugin context (e.g., `plugin-tasks`).
-   `.bg-plugin-subtle`: A translucent background using the plugin color.
-   `.border-plugin-subtle`: A translucent border using the plugin color.
-   `.text-plugin`: Solid text in the plugin color.

### Plugin Color Palette
| Plugin    | Variable            | Color   | Example Class      |
| --------- | ------------------- | ------- | ------------------ |
| Notes     | `--plugin-notes`    | Amber   | `.plugin-notes`    |
| Contacts  | `--plugin-contacts` | Blue    | `.plugin-contacts` |
| Tasks     | `--plugin-tasks`    | Purple  | `.plugin-tasks`    |
| Estimates | `--plugin-estimates`| Cyan    | `.plugin-estimates`|
| Invoices  | `--plugin-invoices` | Green   | `.plugin-invoices` |
| Files     | `--plugin-files`    | Slate   | `.plugin-files`    |
| Mail      | `--plugin-mail`     | Rose    | `.plugin-mail`     |

### Implementation Pattern
```tsx
<Card className={cn(
  "relative p-5 transition-all",
  isSelected 
    ? "plugin-tasks bg-plugin-subtle border-plugin-subtle ring-1 ring-plugin-subtle/50" 
    : "hover:border-plugin-subtle hover:plugin-tasks hover:shadow-md"
)}>
  <h3 className="text-plugin font-semibold">Task Title</h3>
</Card>
```
