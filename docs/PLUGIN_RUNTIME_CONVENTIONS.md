# Plugin runtime conventions (frontend)

Core (`panelHandlers`, `panelRendering`, `core/app/*`, etc.) resolves plugin behavior using **naming conventions** derived from the plugin `name` in `pluginRegistry.ts` and singularization in `pluginSingular.ts`.

This document is the **single reference** for those names. Related: `PLUGIN_ARCHITECTURE_V3.md` (lazy `providerLoader`, Action Registry), `MENTIONS_AND_CROSS_PLUGIN_UI.md`, `NEW_PLUGIN_INTEGRATION_CHECKLIST.md`.

---

## Singular names (`pluginSingular.ts`)

- Most plugin names drop a trailing `s`: `contacts` → `contact`, `tasks` → `task`, `teams` → `team`, `requests` → `request`.
- Irregular: `matches` → `match`, `slots` → `slot`.
- Acronym caps: `ai-providers` → `AIProvider` (via `IRREGULAR_CAP`; not `AiProvider`).
- `schedule` → `schedule` (no trailing `s` to drop).
- Hyphenated names become camelCase before rules apply.

Choose plugin `name` values that work with these rules.

### Content view keys (settings / statistics)

Plugins with full-page settings or extra views use a separate `*ContentView` state (not `panelMode`):

| Plugin     | `contentViewKey`      | Values                                           |
| ---------- | --------------------- | ------------------------------------------------ |
| `teams`    | `teamsContentView`    | `'list' \| 'settings' \| 'statistics' \| 'bulk'` |
| `requests` | `requestsContentView` | `'list' \| 'settings'`                           |
| `schedule` | `scheduleContentView` | `'list' \| 'settings'`                           |
| `matches`  | `matchesContentView`  | `'list' \| 'settings' \| 'statistics'`           |

Settings UI lives in `*SettingsView` components on the list route — **not** in the detail panel form. Prefer `PluginSettingsPageShell` + optional `SettingsCategoryCard` so layout matches Core Settings (`UI_AND_UX_STANDARDS_V3.md` §3.2). Teams **bulk create** uses the same content-view pattern (`TeamsBulkCreateView` when `teamsContentView === 'bulk'`). Matches **statistics** uses `MatchesStatisticsView` when `matchesContentView === 'statistics'` (client-side record stats; see product changelog 2026-08-10).

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

**Full-page settings (`*ContentView === 'settings'`):** settings views live on the list route (`TeamsSettingsView`, `TaskSettingsView`, `MatchSettingsView`, etc.) inside `PluginSettingsPageShell` — not inside the detail panel `Form` component. Dirty Save belongs in the shell header (`saveAction`); Close via `trailing` / `inlineTrailing`.

**Legacy settings footer (`window.submit*`):** some older plugins still register globals for shell footer integration. New plugins should use `PanelFormHandle` + inline Save/Cancel for CRUD forms; see `NEW_PLUGIN_INTEGRATION_CHECKLIST.md` §3.

---

## Registry components

- **`List`** — main page for the plugin route.
- **`Form`** — create/edit/settings form in the detail panel.
- **`View`** — read-only detail in the panel.

If `View` or `Form` is missing when core tries to render that mode, a **dev warning** is logged (`panelRendering.tsx`).

---

## Slug field (`slugField` in registry)

Default deep-link slug uses numeric `id`. Plugins whose primary key is not `id` set `slugField` in `pluginRegistry.ts`:

| Plugin         | `slugField`   | Example URL            |
| -------------- | ------------- | ---------------------- |
| `ai-providers` | `providerKey` | `/ai-providers/openai` |

`AppContent.tsx` resolves items by this field when matching URL slugs.

---

## Detail panel item resolution

`AppContent.tsx` uses `findCurrentItemForOpenPlugin` to prefer the **open panel's** `current{SingularCap}` from that plugin's context (not a generic scan). Required for correct panel header actions (Edit, Close, Update) and titles when `SingularCap` is irregular (e.g. `AIProvider`).

---

## DetailLayout grid

`DetailLayout` (`client/src/core/ui/DetailLayout.tsx`):

- **No sidebar:** single column — main content uses full panel width (add/create forms).
- **With sidebar:** `lg:grid-cols-[1fr_320px]` — main + information/quick actions (default; plugins may override via `gridClassName`).
- **With `rightSidebar`:** three columns on lg.
- **App right rail:** fixed tool strip + flyouts; plugin `sidebar` stays inline in the detail grid (no portal).

Use `mainClassName={PANEL_MAX_WIDTH}` (`max-w-[920px]`) on the main column when following the contacts/ingest form pattern.

---

## Optional explicit contracts

For cross-plugin or optional capabilities, prefer **`pluginContract.ts`** patterns (e.g. duplicate flow) instead of adding more special cases in `core/app/AppContent.tsx` and related orchestration files.

---

## Primary action (ContentHeader)

The **Add** / **Close** button on list pages is resolved in `resolvePrimaryAction.ts`. New plugins should avoid requiring new branches there; use list-local toolbars and plugin settings patterns where possible.

---

## Legacy: `import` plugin titles

`PanelTitles.tsx` still contains a **legacy** config only for the `import` plugin. **Do not extend** that pattern for new plugins; use `getPanelTitle` / `getPanelSubtitle` on context instead.

For **create / edit / settings**, `PanelTitles` prefers a non-empty return from `pluginContext.getPanelTitle` before the generic `nav.*` + `panel.createItem` / `panel.editItem` fallback (needed when one plugin has multiple entity kinds, e.g. garments list vs inventory). Plugins that return `null` for those modes keep the generic labels.

### `getPanelTitle` as React node (DetailHeaderMenus)

View mode may return JSX from `getPanelTitle` — typically a thin `*DetailHeaderMenus` wrapper around shared `DetailHeaderMenus` (`client/src/core/ui/DetailHeaderMenus.tsx`). That node is the **DetailPanel** title only (Actions / Export / extras).

- **Mobile:** open Actions/Export submenu pills appear inline beside the trigger with horizontal scroll; desktop (`md+`) uses a second row below triggers. See [`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md) § Detail header menus.
- `PanelTitles` prefers non-string React nodes from `pluginContext.getPanelTitle` **before** the mobile view early-return that blanks plain text titles (so menus appear on phone).
- There is **no** TopBar breadcrumb chip — do not pass action bars or breadcrumb labels into the shell. Hierarchy is conveyed via sidebar nav + DetailPanel / ContentHeader titles.
- Remount with `key={item.id}` when switching items so open-menu state resets.
