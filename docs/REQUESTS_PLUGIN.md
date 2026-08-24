# Requests — operator notes

Plugin id: **`requests`**. Collects internal and public requests; optional **hybrid routing** into Garments lists (staff-confirmed).

## Enable (local)

Requests is typically already granted. After schema changes:

```bash
npm run migrate:requests-plugin-routing
```

Then **log out and log in** if plugin access changed. Production / `--both` only when you explicitly request release (Release Discipline).

## Surfaces

| Surface           | URL / API                                      | Purpose                                                         |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| Staff list / view | `/requests`                                    | Authenticated CRUD, filters, Send to list when plugin-linked    |
| Settings          | Requests settings (request types)              | Type keys; optional garments link + target list + intake schema |
| Public form       | `/public/request`                              | Conversational wizard; branding via `PUBLIC_REQUESTS_USER_ID`   |
| Public API        | `/api/requests/public/{teams,branding,submit}` | Unauthenticated; rate-limited                                   |

## Plugin routing → Garments (verified)

Hybrid flow: public intake stores structured data; **staff** sends to a garment list. No auto-routing.

1. **Settings** — For a request type, optionally set `plugin: 'garments'`, pick a garment list (`targetListId`), and choose intake fields from the garments allowlist (`name`, sizes, jersey fields, `initials`, `comment`). Legacy type strings coerce to `{ key }`.
2. **Public branding** — Linked types expose `plugin` + `intakeSchema` only; **never** `targetListId`.
3. **Public submit** — When the type is linked, the form shows intake fields; body may include `extra_data`. Server validates against the allowlist, snapshots `plugin_target` / `plugin_target_id`, stores `extra_data`. Response: **`{ success: true }` only**.
4. **Send to list** — Staff `POST /api/requests/:id/send-to-list` (CSRF) creates a `garment_list_person`, records `plugin_routed_*`, sets status **`completed`**. Requires garments plugin access. **409** if already routed.

### Migration

| File                              | Effect                                                                                                |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `144-requests-plugin-routing.sql` | Adds `plugin_target`, `plugin_target_id`, `extra_data`, `plugin_routed_at`, `plugin_routed_entity_id` |

Run: `npm run migrate:requests-plugin-routing` (tenant DBs; existing tenants need this once).

### Architecture

Thin adapters under `plugins/requests/pluginTargets/` (`registry.js`, `garments.js`). ADR: [`docs/ai/adr/REQUEST_PLUGIN_ROUTING.md`](ai/adr/REQUEST_PLUGIN_ROUTING.md). Garments operator notes: [`GARMENTS_PLUGIN.md`](GARMENTS_PLUGIN.md).

## Security residuals (TPM-accepted)

| ID  | Summary                                              |
| --- | ---------------------------------------------------- |
| S3  | Non-atomic create person + mark routed               |
| S4  | Unencrypted `extra_data` (same class as garment PII) |
| S5  | Public description sanitizer optional hardening      |

**Local first; no prod** without an explicit release.
