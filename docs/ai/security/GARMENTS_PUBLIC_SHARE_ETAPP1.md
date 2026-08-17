# Security review notes — Garments Etapp 1 (public share)

**Date:** 2026-08-14 (Etapp 1) · **Layout delta:** 2026-08-17  
**Scope:** Unauthenticated read-only share of garment lists (names, sizes, jersey numbers, checkboxes).  
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

## Residual risks (accepted for Etapp 1 / local)

1. **Minor / youth PII** — List may include children's names and clothing sizes. Anyone with the link can read until expiry/revoke. Operators should use short validity and revoke when done. Two-row layout makes checkbox **labels** easier to read; it does not add fields.
2. **Link leakage** — Same as Notes: treat URL as secret; no password gate in v1.
3. **No edit on public** — v2 editable links are out of scope (reduces write abuse surface for now).

TPM accepted these residuals for Etapp 1 / local. The 2026-08-17 layout delta does not expand the class.

## Recommendations for operators

- Prefer short `validUntil` windows when sharing youth lists.
- Revoke shares after the event (season registration / kit handout).
- Do not put sensitive free-text in fields that are public (sizes/numbers are visible; comments are not on public view).

## Prod

Do **not** enable on production until explicit release decision after Security gate acceptance.
