# ADR: Request plugin routing (Requests → Garments)

**Status:** Accepted (Grind 2 / Solution Architect) — **implemented locally**; **QA Approved**; **Security Approved**; TPM formal acceptance of residuals **S3 / S4 / S5** (2026-08-23). **Local first — no prod release** unless the user explicitly decides.  
**Date:** 2026-08-23  
**Context:** Staff manually copy public clothing requests into garment lists. Need configurable request type → garment list + constrained intake fields, store structured `extra_data`, and one-click staff **Send to list**. Garments only in this etapp; **no auto-routing**; adapter registry leaves room for future plugins.

## Decision

1. **Extend Requests settings** — `settings.requests.requestTypes` evolves from `string[]` to `RequestTypeConfig[]`:

   ```ts
   {
     key: string;                    // value stored as request_type
     plugin?: 'garments' | null;
     targetListId?: string | null;   // garment list id; never public
     intakeSchema?: { key: string; required?: boolean }[] | null;
   }
   ```

   Legacy strings coerce to `{ key }` on read. Unlinked types behave as before.

2. **Constrained intake allowlist (not a form builder)** — Settings store an ordered subset of a **server-owned** garments allowlist: `name`, `shirtSize`, `shortsSize`, `socksSize`, `jerseyNumber`, `jerseyName`, `initials`, `comment`. Public intake excludes list-specific `checkboxValues` and `contactId`. Default when first linking: `name` required; sizes + jersey fields optional.

3. **Persist routing snapshot on `requests` (tenant migration 144)** — Columns: `plugin_target`, `plugin_target_id`, `extra_data` (JSONB), `plugin_routed_at`, `plugin_routed_entity_id`. Snapshot at public submit so later settings edits do not rewrite historical routing intent.

4. **Public branding / submit** — `GET /api/requests/public/branding` exposes `{ key, plugin?, intakeSchema? }` per type; **never** `targetListId`. `POST /api/requests/public/submit` accepts optional `extra_data`; server resolves type config, validates allowlist + required, snapshots target, **ignores** client-supplied `plugin_target*`. Success response is **`{ success: true }` only** (no request row / routing fields to anonymous clients).

5. **Staff Send to list** — Authenticated `POST /api/requests/:id/send-to-list` (CSRF, `requirePlugin('requests')`, garments access when target is garments). Creates `garment_list_person` via garments adapter → `createPerson`; sets audit fields; marks request `status = 'completed'`. **409** if already routed. **No auto-routing.**

6. **Lists for settings** — Reuse `GET /api/garments/lists`. Soft team grouping in UI only; **no** hard `request.team_id === list.team_id` on send.

7. **Adapter registry** — `plugins/requests/pluginTargets/` (`registry.js` + `garments.js`). Future plugins add allowlist + adapter; settings `plugin` enum grows with adapters.

8. **No field encryption for `extra_data`** — Same sensitivity class as `garment_list_persons` and existing submitter fields. Rely on tenant isolation, staff auth, plugin gates, CSRF, public rate limit, allowlist + size caps.

## Out of scope (this etapp)

- Auto-routing / silent list pollution
- Contact matching on public intake
- Checkbox columns on public intake
- Generic form builder / free JSON Schema
- Action Registry for the send mutation
- Production migrate/deploy without explicit release

## Configuration (verified)

| Item        | Value                                                              |
| ----------- | ------------------------------------------------------------------ |
| Migration   | `144-requests-plugin-routing.sql` (tenant)                         |
| Runner      | `npm run migrate:requests-plugin-routing`                          |
| Plugin ids  | `requests` (owner) + `garments` (target; access required for Send) |
| Public form | `/public/request` + `PUBLIC_REQUESTS_USER_ID`                      |

## Security residuals (TPM-accepted 2026-08-23)

| ID  | Severity | Summary                                                                 | Status                          |
| --- | -------- | ----------------------------------------------------------------------- | ------------------------------- |
| S1  | Medium   | Public submit leaked `pluginTargetId` / full `transformRow`             | **Fixed** — `{ success: true }` |
| S3  | Low      | Non-atomic `createPerson` then `markPluginRouted` (orphan / retry edge) | **Accepted residual**           |
| S4  | Low      | Unencrypted `extra_data` PII at rest (same class as garment persons)    | **Accepted residual**           |
| S5  | Low      | Public `description` sanitizer depth optional / hardening               | **Accepted residual**           |

## Consequences

- Operators link clothing request types once (plugin + list + intake fields).
- Staff still confirm Send to list (hybrid).
- Existing string-only request types keep working via coerce.
- Docs: operator notes in [`REQUESTS_PLUGIN.md`](../../REQUESTS_PLUGIN.md); cross-ref [`GARMENTS_PLUGIN.md`](../../GARMENTS_PLUGIN.md).

## References (verified implementation)

- `server/migrations/144-requests-plugin-routing.sql`
- `scripts/run-requests-plugin-routing-migration.js` / `npm run migrate:requests-plugin-routing`
- `plugins/requests/pluginTargets/registry.js`, `plugins/requests/pluginTargets/garments.js`
- `plugins/requests/requestTypeConfig.js`, `plugins/requests/controller.js`, `plugins/requests/model.js`, `plugins/requests/routes.js`
- `plugins/requests/__tests__/pluginRoutingController.test.js`, `garmentsPluginTarget.test.js`, `requestTypeConfig.test.js`
- Client: `RequestsSettingsView`, `PublicRequestForm`, `RequestView`, `requestTypeConfig.ts`, `publicBranding.ts`
- Prior ADR: [`GARMENTS_PLUGIN_ETAPP1.md`](GARMENTS_PLUGIN_ETAPP1.md)
