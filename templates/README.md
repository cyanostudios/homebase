# Plugin golden templates

Start here when adding a new Homebase plugin (local dev only until you merge/deploy).

| Template                    | Copy to                      |
| --------------------------- | ---------------------------- |
| `plugin-backend-template/`  | `plugins/<name>/`            |
| `plugin-frontend-template/` | `client/src/plugins/<name>/` |

## Current conventions (2026-07)

- **Backend:** `function initializeX(context)` — gate routes with `context.middleware.requirePlugin`, tenant DB via `Database.get(req)`, CSRF on mutating routes.
- **Frontend context:** split `*Context.tsx` (types + hook) and `*Provider.tsx` (implementation), like `contacts` / `notes` / `requests`.
- **URL navigation:** `useItemUrl('/<plugin>')` + `navigateToBase()` on panel close; deep-link via `resolveSlug` + pathname ref in Provider.
- **Forms:** `React.forwardRef<PanelFormHandle>` + **inline Save/Cancel** in the form body (`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12). No `window.submit*Form` globals.
- **List shell v3.6:** in-card toolbar (search, grid/list toggle) — see `UI_AND_UX_STANDARDS_V3.md` §0.1 and `YourItemList.tsx`. Do **not** use `ContentToolbar` in `setHeaderTrailing` for list views.
- **Settings:** full-page `*SettingsView` opened from the list (not panel-settings). See `YourItemsSettingsView.tsx`.
- **Dates:** `formatDate` / `formatDateTime` from `@/core/utils/dateFormat` (sv-SE).
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
| CRUD + list shell           | `client/src/plugins/contacts/`                              |
| Richer provider (URL, bulk) | `client/src/plugins/notes/`, `client/src/plugins/requests/` |
