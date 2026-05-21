# New Plugin Integration Checklist

Use when creating a plugin from `templates/plugin-frontend-template` and `templates/plugin-backend-template`. Canonical naming for panels and hooks: **`PLUGIN_RUNTIME_CONVENTIONS.md`**. Design rules (inline Save/Cancel, settings footer): **`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`**, **`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`**.

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
- **CSRF:** import `csrfProtection` from `server/core/middleware/csrf.js`. Until mutating routes are fully aligned with `ENABLE_CSRF` and the client token flow, follow existing plugins: keep `csrfProtection` in the chain as a commented placeholder where needed, and document intent in `SECURITY_GUIDELINES.md` if you diverge.
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
- **`panelKey`:** must match the boolean the hook exposes (e.g. `isContactPanelOpen` → panelKey reflects that string as documented in `PLUGIN_RUNTIME_CONVENTIONS.md`).
- **Singular names:** ensure `pluginSingular.ts` rules fit your `name` (`contacts` → `contact`, `matches` → `match`, etc.).
- **Mounting:** plugin should participate in `useEnabledPlugins()` / `PluginProviders.tsx` so heavy providers load only when the tenant has access.
- **Routes:** add entries in `client/src/core/routing/routeMap.ts` (and any deep-link rules) so list URLs resolve.

---

## 3) Panel contract (mandatory)

- Context + hook expose the patterns in **`PLUGIN_RUNTIME_CONVENTIONS.md`** (e.g. `is{Singular}PanelOpen`, `current{Singular}`, `panelMode`, `save{Singular}`, `close{Singular}Panel`, open helpers).
- **Create / edit `*Form.tsx`:** use **inline Save/Cancel** in the form body. Do **not** register `window.submit*Form` / `window.cancel*Form` for create/edit (see **`PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md`** §12 — panel footer does not drive form save for those modes).
- **Settings `*SettingsForm.tsx`:** register `window.submit*Form` / `window.cancel*Form` where the shell footer must drive save/cancel in `panelMode === 'settings'` (see **`PLUGIN_DEVELOPMENT_STANDARDS_V2.md`** §7).
- **View:** use `DetailLayout` with quick actions, export (if applicable), information sidebar, and **`DetailActivityLog`** when the backend exposes the standard activity pattern on `/api/<plugin>/:id` (same idea as contacts, notes, tasks, slots, matches).

> **Note:** `PLUGIN_RUNTIME_CONVENTIONS.md` still documents `window.submit*` / `window.cancel*` for historical shell integration. For **new** CRUD plugins, treat **§12 of the design alignment checklist** as the source of truth for create/edit forms unless product explicitly needs header/footer-driven submit.

---

## 4) i18n and UX parity

- Add keys under `client/src/i18n/locales/en.json` and `client/src/i18n/locales/sv.json`.
- Prefer shared primitives: `DetailLayout`, `DetailSection`, `ConfirmDialog`, shared `Button`, `Input`, `Textarea`, `NativeSelect`.

---

## 5) Access, security, and ops

- **`plugin.config.js` `requiredRole`:** align with tenant RBAC; confirm enablement in admin/settings flows (`docs/TENANT_USERS_AND_RBAC.md` if relevant).
- **Rate limits / CORS / secrets:** follow `docs/SECURITY_GUIDELINES.md`; document new env vars in `.env.example` if you introduce them.
- **Cron / background jobs:** if applicable, document in `docs/` or reference existing cron docs (e.g. cups auto-refresh pattern in `CUPS_AUTO_REFRESH_CRON.md`).

---

## 6) Definition of done

- `npm run lint` passes.
- `npm run build` passes.
- Manual smoke test:
  - list loads
  - create works
  - edit works
  - view shows correct details
  - settings save/close works via the intended UX (inline vs footer, per sections 3–4)
  - tenant without plugin access sees no broken hooks / no stray panel state
