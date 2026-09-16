# Files plugin — operator notes

Plugin id: **`files`**. Hybrid: **file library UI** (CRUD metadata + preview) and **platform upload/attachment service** used by notes, requests, cups, profile, etc.

**Status (2026-09-08):** Audit/cleanup **committed** on `homebase-v4.0` (`1cac6d41`). UI follow-up (quick context, dense cards, edit-cancel, QC delete) is **working tree** — **QA Approved** + **Security Approved** (2026-09-08). Residuals **F-ATT-1** / **F-SEC-1** await TPM conscious acceptance. **Local-first; not a prod release** without explicit decision. Apply migration `160` locally (and clean duplicate attachment rows if the unique index fails) before relying on idempotent attach in a given environment.

**ADR:** [`ai/adr/FILES_STORAGE_AND_URL_CONTRACT.md`](./ai/adr/FILES_STORAGE_AND_URL_CONTRACT.md)

---

## Surfaces

| Surface             | URL / path                                                                     | Purpose                                                                                            |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Library list / edit | `/files`, `/files/:slug`                                                       | Authenticated CRUD; desktop row → **quick context**; compact / deep-link → **edit** (no full view) |
| Settings (cloud)    | Files settings → Google Drive                                                  | Connect / disconnect Drive; optional user OAuth client id/secret                                   |
| Upload API          | `POST /api/files/upload`                                                       | Multipart; resolves storage via `StorageProviderRegistry`                                          |
| Attachments API     | `/api/files/attachments`                                                       | Link owned files to plugin entities (`file_attachments`)                                           |
| Consumers           | Notes / requests `FileAttachmentsSection`; cups/profile `filesApi.uploadFiles` | Cross-plugin                                                                                       |

### Attachments UI (consumers)

Shared component: `client/src/plugins/files/components/FileAttachmentsSection.tsx`.

- Header: `DetailSection` + `subtleTitle` + Paperclip (`iconPlugin="files"`).
- Rows: `FileIdentityCell` (same identity chrome as Files list name column) inside linked-tile shell.
- Empty / loading: `DETAIL_EMPTY_STATE_CLASS` (plain muted text).
- Download / open / remove: existing `filesApi.getFileDownloadUrl` (same-origin); open uses `target="_blank"` + `rel="noreferrer"`.

---

## Storage resolution (upload)

Verified in `server/core/storage/StorageProviderRegistry.js` → `resolveForUpload`:

1. **R2** if `R2_*` env is fully configured and provider registered
2. Else **Google Drive** if user has connected Drive (token in `googledrive_settings`)
3. Else **local** disk under `server/uploads/files`

R2 object keys default to prefix **`cups/`** (`R2StorageAdapter` `keyPrefix` default) — shared bucket layout with cup/public assets; see [`CUPPAPPEN_PATHS_AND_STORAGE.md`](./CUPPAPPEN_PATHS_AND_STORAGE.md).

**OneDrive / Dropbox:** OAuth UI and adapters were removed from the files plugin surface. DB tables for those providers may still exist unused (`cloudStorageModel` comment). Only `googledrive` is accepted by cloud routes/controller.

---

## URL contract

| Use                                    | Endpoint                       | Notes                                                                                                                                                                                                                                          |
| -------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legacy local URL in DB                 | `GET /api/files/raw/:filename` | Kept for stored `/api/files/raw/...` URLs (cups, invoices, profile). Tenant-scoped lookup; `path.basename` on filename. Not for Drive rows.                                                                                                    |
| In-app preview / download / thumbnails | `GET /api/files/:id/download`  | Canonical stream via storage adapter. `?inline=1` (or `inline=true` / `disposition=inline`) requests inline **only if** `wantsInlinePreview` allows it.                                                                                        |
| SVG                                    | —                              | Upload allowlist includes `image/svg+xml`, but **inline is refused** (forced `Content-Disposition: attachment`) on both `raw` and `download` to avoid same-origin SVG XSS (**F-SVG-1** closed). `X-Content-Type-Options: nosniff` on download. |
| External Drive link                    | `url` field / webViewLink      | May point outside `/api/files/`                                                                                                                                                                                                                |

Client helper: `filesApi.getFileDownloadUrl(id, { inline?: true })` → `/api/files/:id/download` (+ `?inline=1`).

Diagnostic routes **`/storage/objects`** and **`/storage/google-drive/health`** were removed.

---

## Attachments

- Table: `file_attachments` (`user_id`, `plugin_name`, `entity_id`, `file_id`, …).
- Migration **`160-file-attachments-unique.sql`:** unique index on `(user_id, plugin_name, entity_id, file_id)`.
- `POST /attachments`: idempotent — **201** new link, **200** existing (unique violation / findExisting).
- File must exist for current tenant (`getById` without selecting `user_id` so adapter tenant filter applies).
- List JOIN uses **qualified** `fa.user_id` / `f.user_id` (slots pattern); do not rely on bare auto-filter across JOINs.

**Residual F-ATT-1:** No full ACL that the entity belongs to another plugin’s ownership model — only tenant + owned file. Documented for TPM acceptance.

---

## UI conventions (verified)

- Deep-link / panel sync: notes-style `filesDeepLinkPathSyncedRef` + `useLocation` in `FilesProvider`.
- Edit cancel closes the panel directly (`FileForm` → `closeFilePanel`); core cancel-from-edit would call `openFileForView`, which for files opens edit again.
- **List browse:** table-only mail-layout (`FileList` / `FileListTable`). Row click shows stacked `FileView` in the detail column (`FileQuickContextPanel` is the view header card). There is **no** sticky list-side QC. Compact viewport uses panel flow.
- **Exception — Files delete surface:** Delete is on `FileDetailHeaderMenus` (`ConfirmDialog` → `getDeleteMessage` → `deleteFile`), not in the QC body. Bulk delete remains on the list `BulkDeleteModal`. The earlier “Delete inside list QC” waiver does **not** apply — list QC is gone.
- Form: create keeps inline Save/Cancel; edit uses shell header Close/Update. i18n `en`/`sv`.
- Cloud settings: Drive-only + ConfirmDialog.
- Card/table thumbs: images (non-SVG) via download URL (`?inline=1`); SVG excluded client-side and refused inline server-side (**F-SVG-1**).

---

## Client API

- `filesApi` / `cloudStorageApi`: JSON via `createApiClient('/files')`.
- Multipart upload still uses dedicated `apiFetch` + `FormData` (no JSON Content-Type).

---

## Limits (upload)

- Max size **25 MB**; max **20** files per request; MIME allowlist in `plugins/files/allowedMime.js` (shared with routes).
- CSRF on mutating routes; `requirePlugin('files')`; upload rate limiter on `POST /upload`.

---

## Security residuals (awaiting TPM)

| ID          | Severity | Summary                                                                      |
| ----------- | -------- | ---------------------------------------------------------------------------- |
| **F-ATT-1** | Med      | Attach/list without cross-plugin entity ACL (SA-locked for this epic)        |
| **F-SEC-1** | Med      | Drive OAuth client secrets / tokens stored in tenant DB (A1-class plaintext) |

Closed in this epic: tenant SELECT isolation fix; Drive-only cloud surface; F-SVG-1 download inline guard.

---

## Related code

| Area             | Path                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------- |
| Routes / upload  | `plugins/files/routes.js`                                                                |
| Controllers      | `plugins/files/controller.js`, `cloudStorageController.js`                               |
| Models / service | `model.js`, `attachmentModel.js`, `filesService.js`                                      |
| Client           | `client/src/plugins/files/` (incl. `FileQuickContextPanel.tsx`; no `fileColumnCount.ts`) |
| Migration        | `server/migrations/160-file-attachments-unique.sql`                                      |
| Storage registry | `server/core/storage/StorageProviderRegistry.js`                                         |
