# Core Architecture V2 (Current Runtime)

## Overview

Homebase core is split between:

- **Client core orchestration** in `client/src/core/app/`
- **Shared UI primitives** in `client/src/core/ui/`
- **Server core services/middleware** in `server/core/`

This document reflects current runtime behavior and replaces older examples that assumed a monolithic `App.tsx` and a broader `ServiceManager` service matrix.

## Client architecture

## Entry and routing

- `client/src/App.tsx` is a thin entry that renders `AppRoutes`.
- `client/src/core/app/AppRoutes.tsx` handles route-level composition.
- `client/src/core/app/AppContent.tsx` handles authenticated shell composition.
- `client/src/core/app/PluginProviders.tsx` mounts plugin providers.

## Plugin provider loading

Plugin provider wiring comes from `client/src/core/pluginRegistry.ts` and `client/src/core/app/PluginProviders.tsx`.

Current behavior:

- Uses `providerLoader` for lazy loading of heavy plugin providers.
- Uses `NullProvider` as fallback when provider loading is not needed.
- Uses `useEnabledPlugins()` to mount providers only for enabled plugins.

This is the canonical replacement for older docs that showed provider orchestration directly in `App.tsx`.

## AppContext role

`client/src/core/api/AppContext.tsx` handles cross-plugin shell concerns:

- auth/session bootstrap
- shared read models used across plugins
- panel coordination callbacks
- cross-plugin navigation registrations

AppContext should not contain plugin-specific business logic.

## Server architecture

## Core service layer

Canonical implementation: `server/core/ServiceManager.js`.

Active runtime services:

- `logger`
- `tenant`
- `connectionPool`
- `database` (request-aware)

Important APIs:

- `get(serviceName, req?)`
- `getMainPool()`
- `override()` / `reset()` for tests
- `shutdown()`

For full details, see `docs/CORE_SERVICES_ARCHITECTURE.md`.

## Middleware and security

Server middleware is composed in `server/index.ts` and `server/core/middleware/*`.

Key layers include:

- authentication / plugin access checks
- CSRF protection for mutating routes
- rate limiting
- validation and standardized error responses

## Plugin integration contract

A plugin is integrated by:

1. Registering in `pluginRegistry.ts` (components + hook + provider/providerLoader metadata)
2. Exposing backend routes under plugin loader conventions
3. Following shared panel/list/detail UI conventions
4. Using core APIs/middleware rather than cross-plugin direct imports

## Notes

- This document intentionally avoids old pseudo-APIs like `useCoreServices()` and generic `queue/cache/realtime/search` runtime examples that are not currently wired in `ServiceManager`.
- Architecture changes should be mirrored in:
  - `docs/PLUGIN_ARCHITECTURE_V3.md`
  - `docs/PLUGIN_DEVELOPMENT_STANDARDS_V2.md`
  - `docs/CHANGELOG.md`
