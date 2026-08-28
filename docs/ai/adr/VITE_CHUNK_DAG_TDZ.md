# ADR — Vite chunk DAG (avoid ES-module TDZ / white screen)

**Status:** Accepted  
**Date:** 2026-08-28  
**Scope:** Client production build (`vite.config.ts` `manualChunks`).

## Context

After deploy, production showed a blank screen with:

`ReferenceError: Cannot access '<symbol>' before initialization`

in `vendor-shared.*.js`, often called from a plugin chunk. That is ES-module temporal dead zone (TDZ) from **mutual static imports between chunks**. Symptom-level lazy splits per plugin did not remove the underlying graph rule violations.

## Decision

Enforce an acyclic chunk DAG:

```
vendor-react / vendor-radix / vendor-lucide / vendor-date / vendor-tiptap / vendor-pdf
        ↑
vendor-shared   (leaf UI only)
        ↑
app-context     (AppContext + useEnabledPlugins)
        ↑
app-shell       (layout, nav, pluginRegistry, dashboard, Login, Sidebar, …)
        ↑
plugin providers / route UI (Rollup-split; not forced into one chunk per plugin)
```

Rules:

1. **`vendor-shared` must never import** `app-shell`, `app-context`, or any `plugin-*` chunk.
2. Modules that import `AppContext` / navigation / `pluginRegistry` belong in **`app-shell`** or **`app-context`**, not `vendor-shared` (e.g. Sidebar, Login, TimeTrackingWidget).
3. **`node_modules` shared by plugins and core** (e.g. `react-day-picker`, `date-fns`) get an explicit vendor chunk so they never land inside a plugin chunk.
4. **Do not** assign entire `/plugins/<name>/` trees to one manual chunk — that forces cross-plugin UI into circular chunks (e.g. garments ↔ teams). Isolate full `*Provider` files only; let Rollup split the rest.
5. Put Vite’s preload helper in **`vendor-shared`** (`\0vite/preload-helper`) so it does not create a fake `vendor-shared` ↔ `app-shell` cycle.
6. Core must not import plugin runtime into leaf modules used by `vendor-shared` / `app-context` (e.g. `displayNumber` uses a static prefix map; AppContext inlines slot-contact filtering).

## Verification

```bash
npm run build:ui && npm run check:chunk-cycles
```

`scripts/check-chunk-cycles.mjs` fails if `vendor-shared` has a mutual import with `app-shell`, `app-context`, or `plugin-*`.

## Consequences

- Changing `manualChunks` without re-running the cycle check can reintroduce production white screens.
- See also [FRONTEND_BUNDLE_ANALYSIS.md](../FRONTEND_BUNDLE_ANALYSIS.md).
