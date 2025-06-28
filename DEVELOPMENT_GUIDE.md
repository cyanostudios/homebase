# **Development Guide**

## **Constraints**

* Never change core functionality unless explicitly instructed.
* Do not guess or assume what the user wants. If something is unclear, stop and ask for clarification.
* All UI or UX changes must be implemented consistently across:

  * Desktop
  * Tablet
  * Mobile
* Modular design is mandatory. Each visual block (TopBar, LeftColumn, SecondColumn, ThirdColumn, Panels) must:

  * Be isolated from other blocks
  * Be easy to restyle without affecting unrelated parts of the layout
* Remove all:

  * Unused styles and CSS classes
  * Console logs that are no longer used
  * Dead code, especially old components or test views
* Favor clarity over cleverness. Simple, explicit code is preferred over abstract or over-engineered patterns.

> Always ask before making any assumption-based changes or optimizations.

## **UI Architecture Principles**

### **Active Patterns**

* All sidebar panels (match detail, referee detail, edit forms, etc.) must appear in the right-hand column.
* View-specific functionality (matches, referees, dashboard) must never block panel rendering.
* Edit actions (like "Edit Referee") must open the right-hand panel, not a modal or dialog.
* Panels should be mounted globally (e.g., from `App.tsx`) to ensure they're available regardless of the current view.
* Every UI block (TopBar, LeftColumn, MidColumn, RightColumn) must be independently styled and modular.

### **Deprecated Patterns**

* Dialog/modal-based editing (e.g. old `EditRefereeForm` popup) is not allowed.
* Duplicate edit systems – only one unified panel-based edit system is allowed.
* Using CSS overlays or transforms that cause blinking or hide content unintentionally.

### **Migration & Cleanup Policy**

* Legacy modals or unused components must be removed if they duplicate sidebar logic.
* Do not reintroduce deprecated functionality unless explicitly requested in a prompt.
* Always test UI behavior in desktop, tablet, and mobile views.
* Remove unused styles, legacy CSS variables, and console logs during refactoring.
* Always prefer clarity over cleverness in both layout and logic.

## **React Hook Usage Policy**

To prevent runtime errors like:

```
Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

Follow these rules strictly in all components that use React hooks (useState, useEffect, useMemo, etc.):

**Always**

* Declare all hooks at the top of your component body.
* Ensure hooks are not inside conditions, loops, or nested functions.
* Place any conditional rendering logic after hooks are declared.

```tsx
// Correct pattern
function RefereeGrid() {
  const [state, setState] = useState(false);

  if (!state) return null;

  return <div>Ready</div>;
}
```

**Never**

```tsx
// This will crash on resize or viewport switches
function RefereeGrid() {
  if (!props.data) return null;

  const [value, setValue] = useState(false); // Illegal hook call

  return <div>...</div>;
}
```

This is especially important in:

* RefereeGrid
* MatchTable
* Panels
* All layout-level components that re-render on viewport changes.

**Rule of thumb:** Declare all hooks first. Return JSX later. Never mix logic with hook declarations.

## **Schema and Database Compatibility Strategy**

When introducing new fields to existing database tables (e.g., `matches`), follow these best practices to ensure backward compatibility and UI stability:

### Adding a New Field

1. **Database Migration**

   * Always add new columns as nullable or with a sensible default:

     ```sql
     ALTER TABLE matches ADD COLUMN team_size_format TEXT DEFAULT '11v11';
     ```

2. **Backfill Existing Data**

   * Immediately update existing rows to ensure no null values exist:

     ```sql
     UPDATE matches SET team_size_format = '11v11' WHERE team_size_format IS NULL;
     ```

3. **Schema Definition in Code**

   * Avoid marking the field as `.notNull()` in Drizzle initially. Instead:

     ```ts
     teamSizeFormat: text("team_size_format").default("11v11"),
     ```

4. **Frontend Fallback**

   * Always add a UI fallback:

     ```ts
     match.teamSizeFormat || "11v11"
     ```

5. **Type Safety**

   * Update your Zod schemas and inferred types to allow the field to be optional or to have defaults.

6. **Staged Rollout**

   * Don’t introduce UI components that rely on the new field until you have verified that the field is available and safe to use across all relevant contexts (e.g., match list, detail view, edit form).

### Summary

These steps ensure that new fields are introduced smoothly without breaking the display or logic for existing records. Always validate the full pipeline: DB → API → Frontend → UI.
