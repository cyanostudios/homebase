# Migration Guide (V1 to V2)

## Status: Legacy Guide

This document is legacy. It originally contained long-form migration examples that referenced `ServiceManager` directly in plugins, which is no longer approved.

Use these current documents instead:

- `REFACTORING_EXISTING_PLUGINS.md`
- `CORE_SERVICES_ARCHITECTURE.md`
- `PLUGIN_DEVELOPMENT_STANDARDS_V2.md`
- `BACKEND_PLUGIN_GUIDE_V2.md`
- `FRONTEND_PLUGIN_GUIDE_V2.md`
- `SECURITY_GUIDELINES.md`

---

## Migration Benefits

- Infrastructure swappable via configuration
- Security enforced at multiple layers
- Testing simplified with mock adapters
- Automatic tenant isolation
- Audit logging built-in
- Deployment flexibility

---

## Breaking Changes Summary

### Backend Changes

| Old Pattern             | New Pattern                  | Why Changed              |
| ----------------------- | ---------------------------- | ------------------------ |
| Direct DB import        | `@homebase/core` SDK         | Swappable infrastructure |
| Manual tenant filtering | Automatic tenant isolation   | Security & simplicity    |
| `console.log()`         | `Logger.info/warn/error`     | Structured logging       |
| `throw new Error()`     | `throw new AppError()`       | Standardized errors      |
| No validation           | `express-validator` required | Security                 |
| No CSRF                 | `csrfProtection` required    | Security                 |
| No rate limiting        | Rate limiters on endpoints   | Security                 |
| `fs.readFile/writeFile` | `storage.upload/download`    | Cloud-ready storage      |

### Frontend Changes

| Old Pattern         | New Pattern                 | Why Changed     |
| ------------------- | --------------------------- | --------------- |
| No CSRF token       | CSRF token in all mutations | Security        |
| Generic errors      | Standardized error display  | User experience |
| No loading states   | Required loading states     | User experience |
| Optional validation | Required validation display | User experience |

---

## Current Migration Flow

1. Read `REFACTORING_EXISTING_PLUGINS.md` for the step-by-step process.
2. Follow `PLUGIN_DEVELOPMENT_STANDARDS_V2.md` for naming and structure.
3. Implement backend changes using `BACKEND_PLUGIN_GUIDE_V2.md`.
4. Implement frontend changes using `FRONTEND_PLUGIN_GUIDE_V2.md`.
5. Validate security via `SECURITY_GUIDELINES.md`.

---

## Migration Status (Historical)

All legacy plugins were migrated in this order:

- Notes — Simple CRUD, no files, no complex relationships
- Contacts — Simple CRUD, photos need storage service
- Tasks — Relationships, notifications
- Estimates — Complex calculations, PDFs
- Files — Heavy storage usage, requires cloud migration

---

## Why This File Is Still Here

This file remains for historical context only. It intentionally omits legacy code examples to avoid confusion and drift from current standards.
