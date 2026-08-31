# Security review notes — Garments Etapp 1 (public share)

**Date:** 2026-08-14 (Etapp 1) · **Layout delta:** 2026-08-17 · **Person teamId:** 2026-08-31  
**Scope:** Unauthenticated read-only share of garment lists (names, sizes, jersey numbers, checkboxes; later: `ct_sizes` / `ct_audiences`; person `teamId` numeric metadata).  
**Class:** Same residual class as Notes/tasks public shares.

## Controls (implemented)

| Control            | Implementation                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Opaque token       | `crypto.randomBytes(32).toString('hex')` (256-bit)                      |
| Expiry             | `valid_until` enforced on public GET                                    |
| Rate limit         | `publicEndpointLimiter` on `GET /api/garments/public/:token`            |
| Fail-closed create | Tenant share row rolled back if `public_share_routing` register fails   |
| Revoke             | Deletes tenant share + unregisters main routing                         |
| PII reduction      | Public payload clears `comment` on persons (`getListByShareToken`)      |
| Public UI          | `PublicPersonMatrix`: `readOnly` + `hideComment`; checkboxes `disabled` |
| No SEO companion   | No `public-garments` crawlable site in Etapp 1                          |
| Auth mutations     | CSRF + `requirePlugin('garments')`                                      |

## Layout delta (2026-08-17)

Person rows on admin list detail and the public page are two-row blocks with wrapping labeled checkboxes (`PersonBlock`). **No new API fields, tokens, or write endpoints.** Public still hides comments. Residual class **unchanged** (Security Approved 2026-08-17).

## Person teamId (2026-08-31)

Admin person matrix may store optional `team_id` on `garment_list_persons` (migration **155**). Public `getListByShareToken` still clears only `comment`; transformed persons retain **`teamId`** when set. Public UI remains `PersonBlock` (no Team column). Residual class **unchanged** — numeric team id is additional link metadata within the same share-exposure class (Security Approved Gate 5, 2026-08-31).

## Residual risks (accepted for Etapp 1 / local)

1. **Minor / youth PII** — List may include children's names and clothing sizes. Anyone with the link can read until expiry/revoke. Operators should use short validity and revoke when done. Two-row layout makes checkbox **labels** easier to read; it does not add fields. Later fields in the same class: inventory-linked sizes/audiences and optional numeric person `teamId`.
2. **Link leakage** — Same as Notes: treat URL as secret; no password gate in v1.
3. **No edit on public** — v2 editable links are out of scope (reduces write abuse surface for now).

TPM accepted these residuals for Etapp 1 / local. The 2026-08-17 layout delta and 2026-08-31 person-`teamId` public metadata do not expand the residual **class**.

## Recommendations for operators

- Prefer short `validUntil` windows when sharing youth lists.
- Revoke shares after the event (season registration / kit handout).
- Do not put sensitive free-text in fields that are public (sizes/numbers are visible; comments are not on public view).

## Prod

Do **not** enable on production until explicit release decision after Security gate acceptance.
