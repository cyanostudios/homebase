# Plugin golden templates

Start here when adding a new Homebase plugin (local dev only until you merge/deploy).

| Template                    | Copy to                      |
| --------------------------- | ---------------------------- |
| `plugin-backend-template/`  | `plugins/<name>/`            |
| `plugin-frontend-template/` | `client/src/plugins/<name>/` |

## Current conventions (2026)

- **Backend:** `function initializeX(context)` only — gate routes with `context.middleware.requirePlugin`, tenant DB via `Database.get(req)`, CSRF on mutating routes.
- **Frontend forms:** `React.forwardRef<PanelFormHandle>` + `useImperativeHandle` (panel header Save/Cancel). **No** `window.submit*Form` globals.
- **Deep links:** `useLocation` + `resolveSlug` + pathname ref in Provider (see `TemplateContext.tsx`).
- **Lists:** `<Table rowBorders={false}>`, `ContentToolbar` in `setHeaderTrailing`.
- **Detail:** `DetailLayout`, `DetailActivityLog` in view/edit sidebar when activity logging is wired.
- **API:** `createApiClient('/your-items')` — path must match `routeBase` in `plugin.config.js`.

## Checklist

1. `docs/NEW_PLUGIN_INTEGRATION_CHECKLIST.md`
2. `docs/PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`
3. `docs/PLUGIN_RUNTIME_CONVENTIONS.md`
4. Register in `client/src/core/pluginRegistry.ts` + `routeMap.ts`
5. Add migration under `server/migrations/` (see `000-your-items.example.sql`)
6. Enable for your user: `npm run set:tenant-plugins -- --email=... --enable=<name>`
