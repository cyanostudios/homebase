# Legal–Accounted request — Invoices ML program

**Status:** Scheduled (parallel to engineering design)  
**Requested by:** Technical Project Manager  
**Date:** 2026-09-22  
**Program:** Homebase Invoices → Swedish VAT (ML) compliance (epics A–E)  
**Domain split:** Tax invoice content (ML) → Legal–Skatteverket (done 2026-09-15). Bookkeeping / archive length / kassaregister / journal → **this request**.

## Purpose

Obtain Legal–Accounted input so retention and cash-sales rules are explicit. Design and build of epics A–D proceed without waiting. Epic E (immutable snapshot) ships with **keep-all / no deletion policy** until this review returns retention years.

## Timing

| Phase                                             | Relation to this review                                                                            |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Grind 1 decisions + Grind 2 architecture          | Done 2026-09-22 — not blocked                                                                      |
| UI/UX → Backend → Frontend (A–E)                  | May start; do not implement snapshot deletion or retention purge                                   |
| Claim “archive retention compliant”               | **Blocked** on this review                                                                         |
| Momsrapport / journal / verifikation product work | **Out of this program**; schedule only if Accounted says invoices must emit journal hooks now      |
| `cash_invoice` / `receipt` as cash sales          | Build förenklad gate may proceed; **kassaregister** product claims blocked until Accounted answers |

**Target for Accounted reply:** before first release that markets issued-document archive as legally retained for N years. Until then residual risk is accepted: snapshots are kept indefinitely with no purge API.

## Questions for Legal–Accounted

1. **Retention years** — How long must an issued invoice / credit note / cash invoice / receipt remain readable and unchanged for BFL (and related) tax control? Calendar years from issue date, fiscal year, or other?
2. **What must be retained** — Is an immutable PDF sufficient, or must structured data (JSON) also be retained? Any format constraints?
3. **Deletion / correction of archive** — May a tenant ever delete an issued snapshot? Soft-delete? Only after retention expiry?
4. **Journal / verifikation** — Must the Invoices plugin create or link bookkeeping verifikat on issue / payment / credit, or is that a separate bookkeeping product later?
5. **Kassaregister** — When the plugin issues `cash_invoice` or `receipt`, does Swedish kassaregister law apply such that this product cannot claim cash-sale compliance without a certified cash register integration?
6. **Canceled status** — Does marking an issued document `canceled` (without rewriting ML content) create any BFL obligation beyond keeping the original issued copy?

## Product baseline already decided (do not reopen)

- Immutable PDF + JSON snapshot at leave-draft (architecture).
- No deletion policy until Accounted answers.
- Momsrapport / journal / email / Peppol / B2G are **out of this program**.
- Förenklad path for receipt/cash_invoice only when SEK and total incl. VAT ≤ 4 000 (other ML 26–28 grounds need Legal–Skatteverket).

## Artifacts to attach when engaging Accounted

- TPM Grind 1 decision package (plan: Invoice VAT compliance, approved 2026-09-22).
- Solution Architect Output Contract Grind 2 (chat, 2026-09-22) — especially epic E snapshot table and “keep until Accounted”.
- Legal–Skatteverket Part 1 + Part 2 (2026-09-15) for domain boundary.
- Handoff brief Repository Analyst → TPM (2026-09-22).

## Residual risk until reply

| Risk                                  | Acceptance                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| Unknown retention period              | Snapshots kept; no purge; do not claim a specific year count in product/docs    |
| Kassaregister may apply to cash paths | Document types remain available; no marketing claim of kassaregister compliance |
| Journal not in plugin                 | Explicit out of program; Accounted may force a follow-up epic                   |

## Owner

Technical Project Manager tracks this request. When Accounted returns, TPM opens a follow-up scope decision (retention policy + any forced journal/kassaregister epic) before Documentation claims compliance on those points.
