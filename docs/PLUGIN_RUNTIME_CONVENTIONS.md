# Plugin runtime conventions (frontend)

Core (`panelHandlers`, `panelRendering`, `core/app/*`, etc.) resolves plugin behavior using **naming conventions** derived from the plugin `name` in `pluginRegistry.ts` and singularization in `pluginSingular.ts`.

This document is the **single reference** for those names. Related: `PLUGIN_ARCHITECTURE_V3.md` (lazy `providerLoader`, Action Registry), `MENTIONS_AND_CROSS_PLUGIN_UI.md`, `NEW_PLUGIN_INTEGRATION_CHECKLIST.md`.

---

## Singular names (`pluginSingular.ts`)

- Most plugin names drop a trailing `s`: `contacts` → `contact`, `tasks` → `task`, `teams` → `team`, `requests` → `request`.
- Irregular: `matches` → `match`, `slots` → `slot`.
- `schedule` → `schedule` (no trailing `s` to drop).
- Hyphenated names become camelCase before rules apply.

Choose plugin `name` values that work with these rules.

### Content view keys (settings / statistics)

Plugins with full-page settings or extra views use a separate `*ContentView` state (not `panelMode`):

| Plugin     | `contentViewKey`      | Values                                 |
| ---------- | --------------------- | -------------------------------------- |
| `teams`    | `teamsContentView`    | `'list' \| 'settings' \| 'statistics'` |
| `requests` | `requestsContentView` | `'list' \| 'settings'`                 |
| `schedule` | `scheduleContentView` | `'list' \| 'settings'`                 |
| `matches`  | `matchesContentView`  | `'list' \| 'settings'`                 |

Settings UI lives in `*SettingsView` components on the list route — **not** in the detail panel form.

---

## Context shape (per plugin)

The hook returned by `plugin.hook()` should expose (as applicable):

| Pattern                               | Example (`contacts`)           | Purpose                                             |
| ------------------------------------- | ------------------------------ | --------------------------------------------------- |
| `is{SingularCap}PanelOpen`            | `isContactPanelOpen`           | Panel open state                                    |
| `current{SingularCap}`                | `currentContact`               | Item in panel                                       |
| `panelMode`                           | `'create' \| 'edit' \| 'view'` | Panel mode (settings use `*ContentView`, not panel) |
| `save{SingularCap}`                   | `saveContact`                  | Persist from form                                   |
| `delete{SingularCap}` / bulk variants | `deleteContact`, …             | Deletes                                             |
| `close{SingularCap}Panel`             | `closeContactPanel`            | Close panel                                         |
| `open{SingularCap}ForView`            | `openContactForView`           | Open item in view mode                              |
| `open{SingularCap}ForEdit`            | `openContactForEdit`           | Open item in edit mode                              |
| `open{SingularCap}Panel`              | `openContactPanel`             | Open panel (often `(null)` for create)              |

`getSingularCap` builds `{SingularCap}` (e.g. `Contact`, `Match`, `Ingest`).

---

## Form submit / cancel

**Create / edit (`panelMode` create | edit):** use **inline Save/Cancel** in the form body. Do **not** register `window.submit*Form` / `window.cancel*Form` for these modes (`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12).

**Full-page settings (`*ContentView === 'settings'`):** settings forms live on the list route (`TeamsSettingsView`, `MatchSettingsView`, etc.) with their own Save/Cancel — not inside the detail panel `Form` component.

**Legacy settings footer (`window.submit*`):** some older plugins still register globals for shell footer integration. New plugins should use `PanelFormHandle` + inline Save/Cancel for CRUD forms; see `NEW_PLUGIN_INTEGRATION_CHECKLIST.md` §3.

---

## Registry components

- **`List`** — main page for the plugin route.
- **`Form`** — create/edit/settings form in the detail panel.
- **`View`** — read-only detail in the panel.

If `View` or `Form` is missing when core tries to render that mode, a **dev warning** is logged (`panelRendering.tsx`).

---

## Optional explicit contracts

For cross-plugin or optional capabilities, prefer **`pluginContract.ts`** patterns (e.g. duplicate flow) instead of adding more special cases in `core/app/AppContent.tsx` and related orchestration files.

---

## Primary action (ContentHeader)

The **Add** / **Close** button on list pages is resolved in `resolvePrimaryAction.ts`. New plugins should avoid requiring new branches there; use list-local toolbars and plugin settings patterns where possible.

---

## Legacy: `import` plugin titles

`PanelTitles.tsx` still contains a **legacy** config only for the `import` plugin. **Do not extend** that pattern for new plugins; use `getPanelTitle` / `getPanelSubtitle` on context instead.
