# Golden templates

Start here when adding a new Homebase plugin or a Cupappen-class public site.

| Template                    | Copy to                                       |
| --------------------------- | --------------------------------------------- |
| `plugin-backend-template/`  | `plugins/<name>/`                             |
| `plugin-frontend-template/` | `client/src/plugins/<name>/`                  |
| `public-app/`               | `sites/<name>/` or `public-<name>/` (Railway) |

**Public SEO sites (PHP + Caddy):** see [`public-app/README.md`](./public-app/README.md), [`docs/PUBLIC_APP_TEMPLATE.md`](../docs/PUBLIC_APP_TEMPLATE.md), and design rules [`docs/PUBLIC_APP_DESIGN.md`](../docs/PUBLIC_APP_DESIGN.md). Production reference: `public-cups/` (Cupappen). The plugin checklist below does **not** apply to `public-app/` — use the public-app copy checklist instead.

## Current conventions (2026-08)

- **Backend:** `function initializeX(context)` — gate routes with `context.middleware.requirePlugin`, tenant DB via `Database.get(req)`, CSRF on mutating routes. List layout is **not** a plugin `/settings` route.
- **Frontend context:** split `*Context.tsx` (types + `NullProvider`) and `*Provider.tsx` (implementation), like `contacts` / `notes` / `requests`.
- **Panel names:** `is{SingularCap}PanelOpen` from `pluginSingular.ts` (template plugin `your-items` → `isYourItemPanelOpen`). Match `panelKey` in `pluginRegistry.ts`.
- **URL navigation:** `useItemUrl('/<plugin>')` + `navigateToBase()` on panel close; deep-link via `resolveSlug` + pathname ref in Provider.
- **Forms:** `React.forwardRef<PanelFormHandle>` + **inline Save/Cancel** in the form body (`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12). No `window.submit*Form` globals. Same chrome as view: `DETAIL_VIEW_CARD_CLASS`, no `PANEL_MAX_WIDTH`, no `md:-mx-6` bleed (`UI_AND_UX_STANDARDS_V3.md` §3.2).
- **List shell:** card-column — shared `ListToolbar` (search, sort, **1 \| 2 \| 3 \| table**), `*ListItem` + `*ListTable`, `ListFooterBar`, `ListEmptyState`. Persist `listViewMode` (`cards` \| `table`) and `columnCount` via AppContext `getSettings`/`updateSettings`. Do **not** reuse legacy `viewMode` grid/list. Do **not** use `ContentToolbar` in `setHeaderTrailing`. See `UI_AND_UX_STANDARDS_V3.md` §0.1 and `YourItemList.tsx`.
- **List empty state:** `ListEmptyState` with short “No items yet” + Create CTA when truly empty (same `openYourItemPanel(null)` as header Add). No Create on search “no match”.
- **Settings:** full-page `*SettingsView` on the list route (`PluginSettingsPageShell`, dirty header Save). Defaults: `listViewMode` + `columnCount`. See `YourItemsSettingsView.tsx`.
- **View:** `ConfirmDialog` before delete (`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §7); Information `DetailSection` with `collapsible`.
- **Dates/times:** `formatDate` / `formatDateTime` / `formatDateTimeShort` / `formatTime` from `@/core/utils/dateFormat`. Wall-clock hour cycle follows Preferences `timeFormat` (12h/24h) — do not use raw `toLocaleString` / i18n locale for AM/PM.
- **API:** `createApiClient('/your-items')` — path must match `routeBase` in `plugin.config.js`.

## Checklist

1. `docs/NEW_PLUGIN_INTEGRATION_CHECKLIST.md`
2. `docs/PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`
3. `docs/PLUGIN_RUNTIME_CONVENTIONS.md`
4. Register in `client/src/core/pluginRegistry.ts` + `routeMap.ts`
5. Add migration under `server/migrations/` (see `000-your-items.example.sql`)
6. Enable for your user: `npm run set:tenant-plugins -- --email=... --enable=<name>`

## Reference plugins

| Pattern                     | Reference                                                   |
| --------------------------- | ----------------------------------------------------------- |
| CRUD + list shell           | Golden template; then `client/src/plugins/contacts/`        |
| List utils (view/columns)   | `client/src/plugins/files/utils/`                           |
| Richer provider (URL, bulk) | `client/src/plugins/notes/`, `client/src/plugins/requests/` |
