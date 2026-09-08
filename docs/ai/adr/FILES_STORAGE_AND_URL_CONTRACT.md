# ADR — Files storage providers and URL contract

**Status:** Implemented locally. **QA Approved** + **Security Approved** (2026-09-07/08). Residuals **F-ATT-1**, **F-SEC-1** documented — **await TPM conscious acceptance**. **Local-first; not a prod release** without explicit decision.  
**Datum:** 2026-09-08  
**Scope:** Files plugin hybrid library + upload/attachments; storage resolution; raw vs download URLs; Drive-only cloud OAuth surface; attachment uniqueness/idempotency.

**Operator doc:** [`../FILES_PLUGIN.md`](../FILES_PLUGIN.md)  
**Cup / R2 ops:** [`../CUPPAPPEN_PATHS_AND_STORAGE.md`](../CUPPAPPEN_PATHS_AND_STORAGE.md)

---

## Context

Files is both a CRUD library and a shared platform service (`POST /upload`, `file_attachments`). Storage is abstracted through `StorageProviderRegistry` (R2, Google Drive, local). Historical debt included: SELECT lists that named `user_id` and skipped the Postgres tenant auto-filter; OneDrive/Dropbox OAuth UI without adapters; diagnostic storage list/health routes; attachment duplicates; in-app preview using stored `url` (broken for cloud); `download?inline=1` ignoring SVG safety that `raw` already enforced.

---

## Decisions

| Decision                         | Choice                                                                        | Rationale (verified)                                                               |
| -------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Tenant isolation on file SELECTs | Omit `user_id` from SELECT so adapter adds `user_id = $n`                     | Heuristic in `PostgreSQLAdapter._addTenantFilter` skips when `\buser_id\b` appears |
| Attachment list JOIN             | Explicit `fa.user_id` / `f.user_id` + `Context.getUserId` params              | Bare auto-filter is ambiguous when both tables have `user_id` (slots pattern)      |
| Legacy raw URL                   | Keep `GET /api/files/raw/:filename`                                           | Existing DB URLs and external consumers                                            |
| In-app bytes                     | `GET /api/files/:id/download` (+ optional inline hint)                        | Works for local / R2 / Drive via adapters                                          |
| Inline SVG                       | Never (`wantsInlinePreview` + attachment disposition)                         | Same-origin SVG XSS; upload may still accept SVG MIME                              |
| Cloud providers in plugin        | Google Drive only                                                             | OneDrive/Dropbox had no storage adapters                                           |
| Diagnostic APIs                  | Removed                                                                       | Reduced attack/ops surface                                                         |
| Attachments uniqueness           | UNIQUE `(user_id, plugin_name, entity_id, file_id)` + idempotent POST 200/201 | Migration `160`                                                                    |
| Entity ACL on attach             | **Deferred** (residual **F-ATT-1**)                                           | Epic scope: tenant + owned file only                                               |
| OAuth secrets storage            | Plaintext in tenant DB (residual **F-SEC-1**)                                 | Parity with other provider credential stores (A1-class)                            |

---

## Upload resolution order

`StorageProviderRegistry.resolveForUpload(req)`:

1. R2 if configured
2. Else connected Google Drive
3. Else local

R2 keys default to prefix `cups/` unless overridden via adapter `keyPrefix`.

---

## Rejected / deferred

| Alternative                   | Why                                       |
| ----------------------------- | ----------------------------------------- |
| Rewrite global tenant adapter | Out of scope; targeted SELECT/JOIN fixes  |
| Full cross-plugin entity ACL  | Deferred — **F-ATT-1**                    |
| Remove `raw` entirely         | Breaks stored URLs / cups-style consumers |
| Keep OneDrive/Dropbox UI      | No adapters; false capability             |

---

## Security residuals (awaiting TPM)

| ID          | Severity | Summary                                                         | Mitigation today                                                       |
| ----------- | -------- | --------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **F-ATT-1** | Med      | Attach/list without verifying entity ownership in target plugin | Auth + plugin gate + tenant + file ownership                           |
| **F-SEC-1** | Med      | Drive OAuth client secret / tokens in tenant DB                 | Settings API strips secrets from GET response; CSRF on credential POST |

**Closed:** **F-SVG-1** — `downloadById` gates inline via `wantsInlinePreview`; `nosniff` header.

**Out of epic (hardening backlog):** stronger OAuth `state` entropy; path canonicalization guard on `raw`; drop unused OneDrive/Dropbox tables.

---

## Consequences

- Operators and FE must prefer `/:id/download` for preview/download; keep `raw` only for legacy URL shapes.
- Migration `160` may fail until duplicate `(user_id, plugin, entity, file)` rows are cleaned.
- TPM must consciously accept **F-ATT-1** / **F-SEC-1** before treating residuals as closed in the workflow record.
