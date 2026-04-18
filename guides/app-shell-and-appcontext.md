# App shell layout and AppContext performance

This note describes the **frontend shell split** and how **`AppContext`** avoids unnecessary re-renders for `useApp()` consumers.

Related: [`guides/lazy-plugin-providers-architecture.md`](lazy-plugin-providers-architecture.md), [`docs/PLUGIN_RUNTIME_CONVENTIONS.md`](../docs/PLUGIN_RUNTIME_CONVENTIONS.md).

---

## 1. File layout (`client/src`)

| File                                                                         | Role                                                                                                                                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [`App.tsx`](../client/src/App.tsx)                                           | Thin root: renders [`AppRoutes`](../client/src/core/app/AppRoutes.tsx). HMR handling stays here.                                      |
| [`core/app/AppRoutes.tsx`](../client/src/core/app/AppRoutes.tsx)             | Top-level **React Router** `Routes`: public share links under `/public/*`; all authenticated UI under `/*` inside the provider stack. |
| [`core/app/PluginProviders.tsx`](../client/src/core/app/PluginProviders.tsx) | Nests plugin providers from `PLUGIN_REGISTRY`, lazy `providerLoader`, `useEnabledPlugins`, and `onCloseOtherPanels` wiring.           |
| [`core/app/AppContent.tsx`](../client/src/core/app/AppContent.tsx)           | Authenticated shell: plugin hook contexts, `MainLayout`, URL ↔ panel sync, keyboard guard, cross-plugin dialogs.                     |

`ActionProvider` and `GlobalNavigationGuardProvider` wrap **inside** the private route in `AppRoutes.tsx` (same order as before the split).

---

## 2. AppContext stabilization (`core/api/AppContext.tsx`)

Goals:

- **Stable function identities** for auth and settings helpers (`useCallback` on `login`, `signup`, `logout`, `getSettings`, `updateSettings`, and other exported functions that were previously recreated each render).
- **Stable `closeOtherPanels`**: a `useRef<Map<…>>` (`panelCloseFunctionsRef`) mirrors the close-function map updated in `registerPanelCloseFunction` / `unregisterPanelCloseFunction`, so `closeOtherPanels` can be `useCallback` with an empty dependency list and does not churn when panels register.
- **Memoized context value**: the object passed to `AppContext.Provider` is built with `useMemo` and depends only on real data and stable callbacks, so consumers re-render when something meaningful changes—not on every `AppProvider` render.

The public **`AppContextType`** contract is unchanged for plugins and shell code.

---

## 3. When editing

- Prefer keeping **cross-plugin and shell** logic in the files above rather than growing random entry points.
- If you add new fields to `AppContext`, extend **`useMemo` dependencies** so the memoized value stays correct.
- For plugin providers, see [`lazy-plugin-providers-architecture.md`](lazy-plugin-providers-architecture.md) (`PluginProviders` now lives under `core/app/`, not inline in `App.tsx`).
