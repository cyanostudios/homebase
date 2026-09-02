# Client optimistic UI — guideline

Short platform guidance for when (and how) to update UI before a mutation settles. **Do not** treat this as a mandate to migrate every save path.

Helper (pure, no React): `client/src/core/utils/serialLatestQueue.ts`  
Garments PersonMatrix status checkboxes are the first production consumer.

## When it fits

- Independent boolean / membership toggles with a clear prior value
- User expects instant feedback; failure can snap back
- Replace-style mutation (same resource; coalescing intermediate clicks is OK)
- Examples in-repo: garments inventory assign/unassign; garments PersonMatrix status/Paid/master (non-edit); requests mark-viewed; teams training-times / overview card order

## When to avoid (without stronger concurrency)

- Multi-field forms and edit drafts (keep local draft + explicit save)
- First-write validation that must block before showing success (unique constraints, business **409** before the user should see success)
- Operations where intermediate server states are meaningful and must not be coalesced
- Cross-user collaborative editing without versioning/ETag
- Using only `busyKey` / disable-while-saving when users click faster than RTT — prefer **serial-latest** instead

## Required client contract (rapid toggles)

1. **Optimistic local patch** on the provider SSOT (not a disconnected overlay).
2. **Per-key serial queue** (`createSerialLatestQueue`): at most one in-flight save per key.
3. **Latest-wins:** further enqueues while busy only replace the pending payload.
4. **Ignore stale responses:** generation token; older settles must not overwrite newer optimistic state.
5. **Conditional rollback:** restore prior snapshot only when the failed generation is still current; show a visible error (`role="status"`).
6. Queued network calls that would otherwise sync provider state from the response must use an opt-out (e.g. `updatePerson(..., { updateLocalState: false })`) and commit only when the generation is current.

## Inventory snapshot (candidates, not a backlog)

| Surface                                                 | Fit                      | Notes                                                |
| ------------------------------------------------------- | ------------------------ | ---------------------------------------------------- |
| Garments PersonMatrix status / Paid / master (non-edit) | Good                     | Uses `serialLatestQueue` + `patchPersonLocal`        |
| Garments inventory “Show in lists”                      | Good (existing)          | Optimistic patch + rollback; `busyKey` serializes UI |
| Requests mark viewed                                    | Good (existing)          | Provider optimistic timestamp                        |
| Teams training times / overview reorder                 | Good (existing)          | Provider optimistic + rollback patterns              |
| Clubdesk / instructions category order                  | Good (existing)          | Optimistic order                                     |
| Multi-field garment person text/team fields             | Poor for full optimistic | Await PUT (or draft) remains correct                 |
| Mail send, invoice, import, delete, publish             | Poor                     | Need confirmation / irreversible side effects        |

New plugins should follow this doc before inventing a third optimistic style. Migrating existing surfaces onto `serialLatestQueue` is **out of scope** unless an epic explicitly includes it.

## Related

- [`GARMENTS_PLUGIN.md`](./GARMENTS_PLUGIN.md) — PersonMatrix checkbox UX
- Helper tests: `client/src/core/utils/__tests__/serialLatestQueue.test.ts`
