# Golden templates

Start here when adding a new Homebase plugin or a Cupappen-class public site.

| Template                    | Copy to                                       |
| --------------------------- | --------------------------------------------- |
| `plugin-backend-template/`  | `plugins/<name>/`                             |
| `plugin-frontend-template/` | `client/src/plugins/<name>/`                  |
| `public-app/`               | `sites/<name>/` or `public-<name>/` (Railway) |

**Public SEO sites (PHP + Caddy):** see [`public-app/README.md`](./public-app/README.md), [`docs/PUBLIC_APP_TEMPLATE.md`](../docs/PUBLIC_APP_TEMPLATE.md), and design rules [`docs/PUBLIC_APP_DESIGN.md`](../docs/PUBLIC_APP_DESIGN.md). Production reference: `public-cups/` (Cupappen). The plugin checklist below does **not** apply to `public-app/` — use the public-app copy checklist instead.

## Current conventions (2026-09)

- **Backend:** `function initializeX(context)` — gate routes with `context.middleware.requirePlugin`, tenant DB via `Database.get(req)`, CSRF on mutating routes. List layout is **not** a plugin `/settings` route.
- **Frontend context:** split `*Context.tsx` (types + `NullProvider`) and `*Provider.tsx` (implementation), like `contacts` / `notes` / `requests`.
- **Panel names:** `is{SingularCap}PanelOpen` from `pluginSingular.ts` (template plugin `your-items` → `isYourItemPanelOpen`). Match `panelKey` in `pluginRegistry.ts`.
- **Registry (Contacts-class CRUD):** set `contentFlush: true` and `contentOwnsScroll: true` in `pluginRegistry.ts` so the list owns height and the 20/80 mail-layout columns scroll independently (same as `contacts`).
- **URL navigation:** `useItemUrl('/<plugin>')` + `navigateToBase()` on panel close; deep-link via `resolveSlug` + pathname ref in Provider.
- **Forms:** `React.forwardRef<PanelFormHandle>` + **inline Save/Cancel** in the form body (`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12). Mail-layout inline create/edit in the list detail column uses `InlinePanelFormActions` above a `stacked` form — see `YourItemList.tsx`. No `window.submit*Form` globals. Same chrome as view: `DETAIL_VIEW_CARD_CLASS`, no `PANEL_MAX_WIDTH`, no `md:-mx-6` bleed (`UI_AND_UX_STANDARDS_V3.md` §3.2).
- **List shell (Contacts-class mail-layout):** **table-only** list in a **20/80** desktop split (`grid-cols-[minmax(220px,20%)_minmax(0,1fr)]`). Page header: Sort dropdown, Select/Clear, `BulkActionRoundBar`, `RoundExpandableSearch`, Add — **not** `ListToolbar`, **not** cards/column toggles. Right column: `*View` (`stacked`) for preview/full inline view, `InlinePanelFormActions` + `*Form` for inline create/edit, or `*StatisticsView` when nothing is selected. See `YourItemList.tsx` and `client/src/plugins/contacts/components/ContactList.tsx`.
- **List empty state:** `ListEmptyState` with short “No items yet” + Create CTA when truly empty (same `openYourItemPanel(null)` as header Add). No Create on search “no match”.
- **Settings:** full-page `*SettingsView` on the list route (`PluginSettingsPageShell`). Template ships an **empty shell** — add domain categories only; **no** `listViewMode` / `columnCount` layout prefs. See `YourItemsSettingsView.tsx`.
- **View / form / dialogs:** follow **`docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`** (mandatory). Full view uses `*QuickContextPanel` with `variant="full"` + `*DetailHeaderMenus` + optional `headerBelow` tab chips (EXAMPLE: overview \| details in `YourItemView.tsx`). `ConfirmDialog` before delete; duplicate via `DuplicateDialog` when supported.
- **Quick context:** `*QuickContextPanel.tsx` supports `variant="list" | "full"`. Mail-layout list preview renders `*View` in the detail column (not a separate sticky 50/50 QC aside). The `list` variant remains for legacy/alternate patterns — see view guide §1.
- **Dates/times:** `formatDate` / `formatDateTime` / `formatDateTimeShort` / `formatTime` from `@/core/utils/dateFormat`. Wall-clock hour cycle follows Preferences `timeFormat` (12h/24h) — do not use raw `toLocaleString` / i18n locale for AM/PM.
- **API:** `createApiClient('/your-items')` — path must match `routeBase` in `plugin.config.js`.

## Checklist

1. `docs/NEW_PLUGIN_INTEGRATION_CHECKLIST.md`
2. `docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md` (**read before** List / View / Form)
3. `docs/PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`
4. `docs/PLUGIN_RUNTIME_CONVENTIONS.md`
5. Register in `client/src/core/pluginRegistry.ts` + `routeMap.ts`
6. Add migration under `server/migrations/` (see `000-your-items.example.sql`)
7. Enable for your user: `npm run set:tenant-plugins -- --email=... --enable=<name>`

## Reference plugins

| Pattern                      | Reference                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| CRUD + mail-layout list      | Golden template; then `client/src/plugins/contacts/`                                |
| Quick context + header menus | `YourItemQuickContextPanel.tsx`, `ContactQuickContextPanel.tsx`, view guide §1 / §4 |
| Detail header menus          | `YourItemDetailHeaderMenus.tsx`, `ContactDetailHeaderMenus.tsx`                     |
| Richer provider (URL, bulk)  | `client/src/plugins/notes/`, `client/src/plugins/requests/`                         |

**Note:** `templates/plugin-frontend-template/` lives outside `client/src/` and is **not** covered by `npm run lint`. After copying into `client/src/plugins/<name>/`, run lint/build on the plugin tree.
