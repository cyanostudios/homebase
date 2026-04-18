# Lazy plugin providers & enabled plugins (commit `perf(frontend): lazy plugin providers, …`)

This document describes the frontend architecture introduced in the commit that:

- Splits each opt-in plugin’s React context into a **lean `*Context.tsx`** plus a **lazy-loaded `*Provider.tsx`**.
- Registers **async `providerLoader`** entries in `PLUGIN_REGISTRY` and **pre-fetches** real providers after authentication.
- Introduces **`useEnabledPlugins`** for a single source of truth on which plugins the tenant may use.
- Centralises cross-plugin **type-only** imports in **`client/src/types/pluginTypes.ts`** for `AppContext`.
- Adds **Vite `manualChunks`** so each heavy `*Provider` module becomes its own chunk (e.g. `plugin-notes-provider`).
- Adjusts **API `rateLimit`** behaviour in non-production to avoid 429s during heavy parallel client loads and HMR.

Related: [`docs/PLUGIN_RUNTIME_CONVENTIONS.md`](../docs/PLUGIN_RUNTIME_CONVENTIONS.md), [`guides/app-tsx-refactor-guide-for-cursor.md`](app-tsx-refactor-guide-for-cursor.md), [`guides/app-shell-and-appcontext.md`](app-shell-and-appcontext.md).

---

## 1. Goals

1. **Smaller initial JS**: Real provider logic (state, effects, API calls) is not bundled on the first paint path; it loads in separate chunks when the user is authenticated and the plugin is enabled.
2. **Stable hook order**: Disabled plugins still wrap the tree with a **`NullProvider`** that exposes the same context shape with no-ops, so components calling `useContacts()`, `useNotes()`, etc. never break the rules of hooks.
3. **Tenant-aware loading**: Only plugins present in `user.plugins` (plus **settings**) trigger `providerLoader`; others stay on `NullProvider` without downloading the heavy provider chunk.
4. **Predictable chunks**: Build output names provider chunks explicitly for caching and debugging.

---

## 2. Per-plugin file split

For each affected plugin (contacts, cups, estimates, files, ingest, invoices, mail, matches, notes, pulses, slots, tasks):

| File                    | Role                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `context/*Context.tsx`  | `ContactContextType` (or equivalent), `createContext`, `useXxxContext()`, **`XxxNullProvider`** with a static empty/default value, and re-export surface used by hooks. **No** heavy logic. |
| `context/*Provider.tsx` | **`XxxProvider`**: `useState`, `useEffect`, API calls, panel logic, etc. Implements the real context value and wraps children in `XxxContext.Provider`.                                     |

**Settings** is an exception: it remains a single eager provider (always on, no `NullProvider` / `providerLoader` split in the same way).

Hooks stay in `hooks/useXxx.ts` and typically call `useXxxContext()` from the lean context module.

---

## 3. `PLUGIN_REGISTRY` (`client/src/core/pluginRegistry.ts`)

Each opt-in entry includes:

- **`Provider`**: Synchronous fallback — for lazy plugins this is the **`NullProvider`** from `*Context.tsx`. Until the async chunk resolves, the tree uses this.
- **`providerLoader`**: Optional `() => import('…/XxxProvider').then(m => m.XxxProvider)`. When defined, [`PluginProviders`](../client/src/core/app/PluginProviders.tsx) invokes it after auth for enabled plugins.
- **`NullProvider`**: Used when the tenant **does not** have the plugin; the provider stack skips loading the real implementation entirely.

Eager imports at the top of `pluginRegistry.ts` are limited to **NullProviders + hooks** so the registry module stays light. **List / Form / View / dashboardWidget** remain `React.lazy` as before.

---

## 4. `PluginProviders` (`client/src/core/app/PluginProviders.tsx`)

Behaviour:

1. Reads **`useEnabledPlugins()`** → `Set` of plugin names (`user.plugins` + always **`settings`**).
2. On **`isAuthenticated`**, for each registry entry with `providerLoader` whose `name` is in `enabledNames`, calls `providerLoader()` and stores the resolved component in a `Map`.
3. When building the nested provider tree:
   - If plugin **disabled** and `NullProvider` exists → render `NullProvider` (no chunk load).
   - If plugin **enabled** → render **`loadedProviders.get(name) ?? FallbackProvider`**. Until the chunk loads, `FallbackProvider` is the null provider; then it swaps to the real `XxxProvider`.

`closeHandlers` per plugin name are memoised so `onCloseOtherPanels` wiring stays stable.

---

## 5. `useEnabledPlugins` (`client/src/hooks/useEnabledPlugins.ts`)

```ts
// Conceptual behaviour
new Set([...(user?.plugins ?? []), 'settings']);
```

- Memoised on **`user?.plugins`** only.
- Used by **`PluginProviders`**, **`Sidebar`**, and **`Dashboard`** so enabled-plugin logic is consistent and not recomputed from scratch in multiple places.

---

## 6. `client/src/types/pluginTypes.ts`

- **Type-only** re-exports: `Contact`, `Estimate`, `Match`, `Note`, `NoteShare`, `Slot`, `Task`, etc.
- Lets **`AppContext.tsx`** depend on a single barrel instead of importing types from many plugin paths (cleaner graph, no runtime cost).

---

## 7. Vite `manualChunks` (`vite.config.ts`)

Each path matching `…/plugins/<name>/context/<Name>Provider.tsx` is assigned a dedicated chunk name, e.g.:

- `plugin-contacts-provider`
- `plugin-notes-provider`
- `plugin-tasks-provider`
- … (and cups, estimates, files, ingest, invoices, mail, matches, pulses, slots)

This aligns with dynamic `import()` from `providerLoader` so providers are not duplicated unpredictably inside large shared bundles.

---

## 8. Rate limiting (`server/core/middleware/rateLimit.js`)

Changes relevant to this frontend work:

- **Non-production**: global limiter can be **skipped by default** so parallel provider/API hydration and **Vite HMR full reloads** do not exhaust a low dev cap and return **429**.
- **`FORCE_RATE_LIMIT=1`** (or `true`) forces limiting locally when you need to test behaviour.
- **`skip`** paths for global limiter account for **`req.path`** with or without `/api` prefix (e.g. `/health` vs `/api/health`) after `app.use('/api', globalLimiter)` strips the prefix.
- **Auth limiter**: stricter in production; in development the auth limiter’s `skip` avoids blocking normal local login flows.

---

## 9. Checklist for new plugins

When adding a new opt-in plugin to the same pattern:

1. Add `XxxContext.tsx` (types, context, hook, **`XxxNullProvider`**, empty defaults).
2. Add `XxxProvider.tsx` with real implementation; export **`XxxProvider`** as named export.
3. In **`pluginRegistry.ts`**: set `Provider: XxxNullProvider`, `NullProvider: XxxNullProvider`, `providerLoader: () => import('…/XxxProvider').then(m => m.XxxProvider)`.
4. In **`vite.config.ts`**: add a `manualChunks` rule for the new `XxxProvider.tsx` path.
5. Ensure **`useEnabledPlugins`** continues to derive enabled set from `user.plugins` (add plugin name server-side when granting access).
6. Follow naming in **`docs/PLUGIN_RUNTIME_CONVENTIONS.md`** for context fields and hooks.

---

## 10. Files touched (reference)

| Area      | Files                                                                                                                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell | `client/src/App.tsx`                                                                                                                            |
| Core      | `client/src/core/api/AppContext.tsx`, `client/src/core/pluginRegistry.ts`, `client/src/core/ui/Dashboard.tsx`, `client/src/core/ui/Sidebar.tsx` |
| Hook      | `client/src/hooks/useEnabledPlugins.ts`                                                                                                         |
| Types     | `client/src/types/pluginTypes.ts`                                                                                                               |
| Plugins   | `client/src/plugins/*/context/*Context.tsx`, `*Provider.tsx` (12 plugins)                                                                       |
| Build     | `vite.config.ts`                                                                                                                                |
| API       | `server/core/middleware/rateLimit.js`                                                                                                           |

Commit message summary: _lazy plugin providers, `useEnabledPlugins`, plugin types barrel; `providerLoader` + pre-fetch on auth; Vite provider chunks; rateLimit tweak._
