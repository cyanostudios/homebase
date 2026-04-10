# Plugin runtime conventions (frontend)

Core (`panelHandlers`, `panelRendering`, `App.tsx`, etc.) resolves plugin behavior using **naming conventions** derived from the plugin `name` in `pluginRegistry.ts` and singularization in `pluginSingular.ts`.

This document is the **single reference** for those names. See also `guides/core-architecture-review-for-cursor.md`, `guides/lazy-plugin-providers-architecture.md` (Context vs `*Provider.tsx`, `providerLoader`, pre-fetch on auth, Vite chunks), and `guides/notes-tasks-shares-and-ui-updates.md` (task/note shares, note→task dialog, slots/detail UI).

---

## Singular names (`pluginSingular.ts`)

- Most plugin names drop a trailing `s`: `contacts` → `contact`, `tasks` → `task`.
- Irregular: `matches` → `match`, `slots` → `slot`.
- Hyphenated names become camelCase before rules apply.

Choose plugin `name` values that work with these rules.

---

## Context shape (per plugin)

The hook returned by `plugin.hook()` should expose (as applicable):

| Pattern                               | Example (`contacts`)                         | Purpose                                |
| ------------------------------------- | -------------------------------------------- | -------------------------------------- |
| `is{SingularCap}PanelOpen`            | `isContactPanelOpen`                         | Panel open state                       |
| `current{SingularCap}`                | `currentContact`                             | Item in panel                          |
| `panelMode`                           | `'create' \| 'edit' \| 'view' \| 'settings'` | Panel mode                             |
| `save{SingularCap}`                   | `saveContact`                                | Persist from form                      |
| `delete{SingularCap}` / bulk variants | `deleteContact`, …                           | Deletes                                |
| `close{SingularCap}Panel`             | `closeContactPanel`                          | Close panel                            |
| `open{SingularCap}ForView`            | `openContactForView`                         | Open item in view mode                 |
| `open{SingularCap}ForEdit`            | `openContactForEdit`                         | Open item in edit mode                 |
| `open{SingularCap}Panel`              | `openContactPanel`                           | Open panel (often `(null)` for create) |

`getSingularCap` builds `{SingularCap}` (e.g. `Contact`, `Match`, `Ingest`).

---

## Form submit / cancel (`window`)

Create/edit (and some settings) forms register globals so the shell **Save** / **Cancel** can trigger them:

- `window.submit{PluginCap}Form` — e.g. `submitContactForm`, `submitNoteForm`
- `window.cancel{PluginCap}Form` — e.g. `cancelContactForm`

`PluginCap` is derived from the plugin name (camelCase, first letter uppercased); `panelHandlers` also tries the **singular cap** variant (e.g. `submitContactForm`).

Register these in the plugin **Form** component (`useEffect` on mount, clear on unmount). See `client/src/types/global.d.ts` for the declared keys.

The **settings** plugin uses `closeSettingsPanel` on context for cancel; forms still register `submit*` / `cancel*` where applicable.

---

## Registry components

- **`List`** — main page for the plugin route.
- **`Form`** — create/edit/settings form in the detail panel.
- **`View`** — read-only detail in the panel.

If `View` or `Form` is missing when core tries to render that mode, a **dev warning** is logged (`panelRendering.tsx`).

---

## Optional explicit contracts

For cross-plugin or optional capabilities, prefer **`pluginContract.ts`** patterns (e.g. duplicate flow) instead of adding more special cases in `App.tsx`.

---

## Primary action (ContentHeader)

The **Add** / **Close** button on list pages is resolved in `resolvePrimaryAction.ts`. New plugins should avoid requiring new branches there; use list-local toolbars and plugin settings patterns where possible.

---

## Legacy: `import` plugin titles

`PanelTitles.tsx` still contains a **legacy** config only for the `import` plugin. **Do not extend** that pattern for new plugins; use `getPanelTitle` / `getPanelSubtitle` on context instead.
