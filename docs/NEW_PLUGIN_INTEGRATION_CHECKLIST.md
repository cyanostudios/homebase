# New Plugin Integration Checklist (Contract v2)

Use this checklist when creating a new plugin from `templates/plugin-frontend-template` and `templates/plugin-backend-template`.

## 1) Backend wiring

- Copy `templates/plugin-backend-template` to `plugins/<your-plugin>/`.
- Set `name` and `routeBase` in `plugins/<your-plugin>/plugin.config.js`.
- Ensure `plugin-loader.js` discovers the plugin (folder includes `plugin.config.js` and `index.js`).
- Add tenant migrations in `server/migrations/` for plugin tables.
- Add optional migration runner in `scripts/` if data migration is required.

## 2) Frontend wiring

- Copy `templates/plugin-frontend-template` to `client/src/plugins/<your-plugin>/`.
- Rename template symbols (`YourItem*`) to plugin-specific names.
- Register plugin in `client/src/core/pluginRegistry.ts`:
  - `name`, `Provider`, `providerLoader`, `NullProvider`, `hook`, `panelKey`
  - `components.List`, `components.Form`, `components.View`
  - `navigation` config
- Ensure `Provider` is a lightweight fallback (normally `NullProvider`) and put the heavy provider implementation behind `providerLoader`.
- Verify the plugin is discovered by `useEnabledPlugins()` flow so `client/src/core/app/PluginProviders.tsx` mounts it only when enabled.
- Ensure route mapping exists in `client/src/core/routing/routeMap.ts`.

## 3) Panel contract (mandatory)

- Context exposes:
  - `is<Plugin>PanelOpen`
  - `current<Plugin>`
  - `panelMode: 'create' | 'edit' | 'view' | 'settings'`
  - `save<Plugin>()`, `close<Plugin>Panel()`
- **Create/edit `*Form.tsx`:** Inline **Save/Cancel** in the form body. Do **not** register `window.submit*Form` / `window.cancel*Form` for create/edit (see `PLUGIN_DESIGN_ALIGNMENT_CHECKLIST.md` §12).
- **Settings `*SettingsForm.tsx` (if any):** Register `window.submit<Plugins>Form` / `window.cancel<Plugins>Form` so `PanelFooter` Save/Cancel work in `panelMode === 'settings'` (see `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` §7).
- View uses `DetailLayout` with quick actions, export (if applicable), information sidebar, and **`DetailActivityLog`** when the plugin uses standard `/api/<plugin>/:id` activity middleware (same pattern as contacts, notes, tasks, slots, matches).

## 4) i18n and UX parity

- Add plugin keys in:
  - `client/src/i18n/locales/en.json`
  - `client/src/i18n/locales/sv.json`
- Use shared UI primitives:
  - `DetailLayout`, `DetailSection`, `ConfirmDialog`
  - shared `Button`, `Input`, `Textarea`, `NativeSelect`

## 5) Definition of done

- `npm run lint` passes.
- `npm run build` passes.
- Manual smoke test passes:
  - list loads
  - create works
  - edit works
  - view shows correct details
  - settings save/close works via header actions
