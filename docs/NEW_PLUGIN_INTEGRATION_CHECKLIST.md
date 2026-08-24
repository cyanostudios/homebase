# New Plugin Integration Checklist

Use when creating a plugin from `templates/plugin-frontend-template` and `templates/plugin-backend-template`. Canonical naming for panels and hooks: **`PLUGIN_RUNTIME_CONVENTIONS.md`**. Design rules (inline Save/Cancel, settings footer): **`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`**, **`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`**.

**Obligatorisk UI-läsning innan List / View / Form:** **[`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md)** — quick context, full detail, view/edit-sync, knappar/rubriker, delete/duplicate/bulk/unsaved dialoger. Definition of Done i den guiden (§8) gäller tillsammans med §6 nedan.

**Related (not this checklist):** Cupappen-class public SEO sites use [`templates/public-app/`](../templates/public-app/) + [`PUBLIC_APP_TEMPLATE.md`](PUBLIC_APP_TEMPLATE.md). Optional companion Node API: `plugins/public-<name>/` (copy `plugins/public-cups/`). **Concrete Etapp 1 examples:** `plugins/instructions` + public companion — see [`ai/adr/INSTRUCTIONS_PLUGIN_ETAPP1.md`](ai/adr/INSTRUCTIONS_PLUGIN_ETAPP1.md); Clubdesk admin + public companion — [`ai/adr/CLUBDESK_PLUGIN_ETAPP1.md`](ai/adr/CLUBDESK_PLUGIN_ETAPP1.md) + [`ai/adr/CLUBDESK_PUBLIC_COMPANION.md`](ai/adr/CLUBDESK_PUBLIC_COMPANION.md); Garments (Kläder) lists + inventory + Notes-style share — [`ai/adr/GARMENTS_PLUGIN_ETAPP1.md`](ai/adr/GARMENTS_PLUGIN_ETAPP1.md) + [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md).

---

## 1) Backend wiring

- Copy `templates/plugin-backend-template` to `plugins/<your-plugin>/`.
- **Initializer (required):** export a single function `function initializeYourPlugin(context)` and `module.exports = initializeYourPlugin`. The root `plugin-loader.js` always calls it with one `context` object (no `(pool, requirePlugin)`).
- **`context` usage:**
  - Gate routes with `const requirePlugin = context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());` then `const gate = requirePlugin(config.name)`.
  - Prefer tenant DB access via **`Database.get(req)`** from `@homebase/core` in the model (same as the template). Only use **`context.pool`** if you intentionally need the main app pool (see `plugins/settings` as the rare pattern).
- **`plugin.config.js`:** set `name`, `routeBase` (must match frontend API base path, e.g. `/api/your-items`), `requiredRole`, `description`.
- **Routes factory:** `createYourRoutes(controller, context)` — pass `context` through; do not thread `requirePlugin` as a separate top-level argument.
- **Validation:** use `validateRequest` and `commonRules` / `body` from `server/core/middleware/validation.js` (same stack as production plugins).
- **CSRF:** import `csrfProtection` from `server/core/middleware/csrf.js` on all POST/PUT/PATCH/DELETE routes (template already does). Server uses session-backed `csrf({ cookie: false })` when `ENABLE_CSRF=true` — see `docs/RAILWAY_HOMEBASE_SETUP.md` §5. Frontend must use `createApiClient` / `apiFetch` (template `templateApi.ts`).
- **List layout settings:** persist `listViewMode` / `columnCount` with AppContext `getSettings` / `updateSettings` (core `user_settings`). Do **not** add a plugin `GET/PUT /settings` for that (template has none).
- **Discovery:** folder under `plugins/<name>/` with `index.js` + `plugin.config.js` so `plugin-loader.js` picks it up.
- **Schema:** add tenant migrations under `server/migrations/` for plugin tables; optional extra runner under `scripts/` if you need data backfills.

---

## 2) Frontend wiring

- Copy `templates/plugin-frontend-template` to `client/src/plugins/<your-plugin>/`.
- **Rename everywhere:** template IDs like `your-items`, symbols like `YourItem` / `YourItems*`, API paths, and `registerPanelCloseFunction('<plugin-name>', …)` must match the real plugin `name` (kebab-case) from `plugin.config.js`.
- **API client:** base URL must match `routeBase` (e.g. `/api/your-items`). Prefer **`createApiClient('/your-items')`** from `client/src/core/api/createApiClient.ts` (uses **`apiFetch`** → CSRF when `ENABLE_CSRF=true`). Map **`details`** from validation responses to field errors; for FormData/uploads copy the pattern from `filesApi.ts` instead of the default JSON client.
- **Register in `client/src/core/pluginRegistry.ts`:**
  - Required: `name`, `Provider`, `hook`, `panelKey`, `components.List`, `components.Form`, `components.View`.
  - Usually: `providerLoader`, `NullProvider`, `navigation`.
  - Optional: `dashboardWidget`, `displayPrefix`, `contentFlush`, `slugField`, `contentViewKey`, `noPrimaryAction`, `getViewExtraProps`, `getFormExtraProps` (see JSDoc on `PluginRegistryEntry` in that file).
  - **Home dashboard (v1):** den sammansatta startsidan (`client/src/core/ui/Dashboard.tsx` + `dashboard/*`) läser **inte** `dashboardWidget`. Nya översiktsytor läggs i core-dashboard-sektionerna (villkorligt via `useEnabledPlugins`). Se [`HOME_DASHBOARD.md`](HOME_DASHBOARD.md). `dashboardWidget` / `*DashboardWidget.tsx` kan finnas kvar i registret men är legacy för den shellen.
- **`panelKey`:** must match the boolean the hook exposes (e.g. `isContactPanelOpen`). Template plugin `your-items` uses `isYourItemPanelOpen` (`pluginSingular.ts`).
- **`NullProvider`:** copy `YourItemsNullProvider` from the template context; register it as eager `Provider` / `NullProvider` with `providerLoader` for the real provider.
- **Singular names:** ensure `pluginSingular.ts` rules fit your `name` (`contacts` → `contact`, `matches` → `match`, `your-items` → `yourItem`).
- **List UI:** keep the template card-column shell (`ListToolbar`, `1 | 2 | 3 | table`, `*ListItem`, `*ListTable`, `ListFooterBar`). See `UI_AND_UX_STANDARDS_V3.md` §0.1.
- **Mounting:** plugin should participate in `useEnabledPlugins()` / `PluginProviders.tsx` so heavy providers load only when the tenant has access.
- **Routes:** add entries in `client/src/core/routing/routeMap.ts` (and any deep-link rules) so list URLs resolve.

---

## 3) Panel contract (mandatory)

- **Read first:** [`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md) (all sections) — do not invent quick-context, detail sidebar order, button colors, or confirm dialogs.
- Context + hook expose the patterns in **`PLUGIN_RUNTIME_CONVENTIONS.md`** (e.g. `is{Singular}PanelOpen`, `current{Singular}`, `panelMode`, `save{Singular}`, `close{Singular}Panel`, open helpers).
- **Create / edit `*Form.tsx`:** implement **`PanelFormHandle`** (`forwardRef` + `useImperativeHandle`) plus **inline Save/Cancel**. Match view chrome: `DETAIL_VIEW_CARD_CLASS`, no `PANEL_MAX_WIDTH`, no `md:-mx-6` bleed (`UI_AND_UX_STANDARDS_V3.md` §3.2). Do **not** use `window.submit*Form` globals (see golden template + **`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`** §12 + view guide §3).
- **View:** use `DetailLayout` with quick actions, `ConfirmDialog` before delete (§7 of the design checklist / view guide §5), collapsible Information `DetailSection`, and **`DetailActivityLog`** when the backend exposes the standard activity pattern (same idea as contacts, notes, tasks, slots, matches). Follow sidebar order in the view guide §2.
- **Quick context (when the entity warrants a list-side preview):** implement `*QuickContextPanel` + `useQuickContextPreview` per view guide §1 (reference: garments inventory). No delete/duplicate inside the panel.
- **Tabular import (optional):** If the plugin needs CSV/Excel/paste import, wire Settings → core `ImportWizard` + plugin `import*` returning `{ successCount, failureCount }`, and offer `downloadImportCsvTemplate` with an example row — see `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §5 and ADR `ai/adr/TABULAR_IMPORT_EXPORT.md`. Do not create a separate import plugin. Domän/API imports stay plugin-local.

**Reference plugins (2026-06):**

- **Multi-tab detail view:** `TeamView` — overview cards; tabs: overview, schedule, seriesTeams, responsibles, notes, requests, matches (matches only when plugin enabled). Overview card order includes `seriesTeams` (see `teamOverviewCards.ts`).
- **Team relations:** `Requests` (`team_id`, `TeamRequestsSection`), `Matches` (`team_id`, `TeamMatchesSection`), match record stats tab (`statistics` → `TeamMatchStatsSection` when matches plugin enabled).
- **Series teams tab:** `SeriesTeamsSection` — responsibles with empty/`null` `seriesTeam` (whole team) appear as badges on every series-team row (labeled via `teams.form.seriesTeamAll`).
- **Full-page settings:** Use `PluginSettingsPageShell` + optional `SettingsCategoryCard` (see `UI_AND_UX_STANDARDS_V3.md` §3.2). Examples: `TeamsSettingsView`, `TaskSettingsView`, `MatchSettingsView` via `*ContentView === 'settings'` (not panel `Form`).
- **Cross-plugin links:** `ScheduleList` → teams via URL; see `MENTIONS_AND_CROSS_PLUGIN_UI.md`.
- **Teams list meta (`TeamCard`):** next training; optional next match (matches plugin + `MatchProvider`); optional days-until-training-after-break countdown when an ongoing `season_breaks` entry exists (red when &lt; 7 days). Stats age-group section sums series teams via `getDisplaySeriesTeams`.
- **Matches statistics:** `MatchesStatisticsView` when `matchesContentView === 'statistics'` — club + per-team record stats (year × home/away) via client aggregation (`matchStats.ts`); requires settings `defaultHomeTeam` for both club and per-team result stats (no silent W/D/L without it).

> **Note:** `PLUGIN_RUNTIME_CONVENTIONS.md` still documents `window.submit*` / `window.cancel*` for historical shell integration. For **new** CRUD plugins, treat **§12 of the design alignment checklist** as the source of truth for create/edit forms unless product explicitly needs header/footer-driven submit.

---

## 4) i18n and UX parity

- Add keys under `client/src/i18n/locales/en.json` and `client/src/i18n/locales/sv.json`.
- Full-page settings: include `settingsSubtitle` and, when using category cards, short `settingsCategories.*Description` (or equivalent) keys — see Core Settings / `PluginSettingsPageShell` pattern.
- Prefer shared primitives: `DetailLayout`, `DetailSection`, `ConfirmDialog`, shared `Button`, `Input`, `Textarea`, `NativeSelect`.
- **List empty state:** use `ListEmptyState` (`@/core/ui/ListEmptyState`). Add short `*.noYet` (`No X yet` / `Inga X ännu`) and `*.noMatch`; when the list is truly empty, pass `createLabel` + `onCreate` (same open-create handler as header Add / mobile bottom-bar Add). Do not put “Click Add…” prose in `noYet`. See `UI_AND_UX_STANDARDS_V3.md` §0.1 and `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §6.
- **Mobile actions:** register `useMobileActions({ onAdd, onSettings? })` from `@/core/ui/MobileActionsContext` in the list component (before any early returns). Hide the desktop title/Add/Settings header on mobile (`hidden md:flex …`). See `UI_AND_UX_STANDARDS_V3.md` §0.2.

---

## 5) Access, security, and ops

- **`plugin.config.js` `requiredRole`:** align with tenant RBAC; confirm enablement in admin/settings flows (`docs/TENANT_USERS_AND_RBAC.md` if relevant).
- **Rate limits / CORS / secrets:** follow `docs/SECURITY_GUIDELINES.md`; document new env vars in `.env.example` if you introduce them.
- **Cron / background jobs:** if applicable, document in `docs/` or reference existing cron docs (e.g. cups auto-refresh pattern in `CUPS_AUTO_REFRESH_CRON.md`).

---

## 6) Definition of done

- `npm run lint` passes.
- `npm run build` passes.
- **[`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md) §8** verification checklist completed (quick context if applicable, full view actions/dialogs, view/edit sync, i18n).
- Manual smoke test:
  - list loads (cards 1/2/3 and table)
  - empty list shows short `No X yet` + Create button that opens create
  - search/filter with no results shows match copy **without** Create
  - create works
  - edit works and matches view chrome
  - view shows correct details; delete asks for confirmation (`ConfirmDialog` danger); duplicate (if supported) uses `DuplicateDialog` + list highlight
  - settings save/close works via dirty header Save (`listViewMode` / `columnCount`)
  - tenant without plugin access sees no broken hooks / no stray panel state
