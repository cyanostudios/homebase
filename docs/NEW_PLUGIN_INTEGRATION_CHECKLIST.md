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
  - `name`, `Provider`, `hook`, `panelKey`
  - `components.List`, `components.Form`, `components.View`
  - `navigation` config
- Ensure route mapping exists in `client/src/core/routing/routeMap.ts`.

## 3) Panel contract (mandatory)

- Context exposes:
  - `is<Plugin>PanelOpen`
  - `current<Plugin>`
  - `panelMode: 'create' | 'edit' | 'view' | 'settings'`
  - `save<Plugin>()`, `close<Plugin>Panel()`
- Form registers panel-header callbacks:
  - `window.submit<Plugins>Form`
  - `window.cancel<Plugins>Form`
  - Optional singular aliases for compatibility
- View uses detail layout with quick actions and metadata sidebar.

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
