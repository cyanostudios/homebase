# ADR: Invoices Payments and Statistics (Recurring paused)

**Status:** Accepted (Recurring deferred)  
**Date:** 2026-09-04  
**Updated:** 2026-09-04 — Recurring application surface removed; payments + statistics remain.  
**Updated:** 2026-09-04 — Payment ledger ownership + status sanitize (keep current workflow status).

## Context

Invoices had stub sidebar/in-page submenu pages (Recurring / Payments / Reports) with no content. Product shipped Payments MVP plus Matches-style statistics on one list route. Recurring was started and then **paused** — all app/API/UI for schedules removed pending a later decision.

## Decision

1. **No submenu.** Single nav entry `invoices` → `/invoices`. Legacy `/invoices/recurring|payments|reports` map to `invoices`.
2. **Content views** on the plugin: `list | settings | statistics` (Matches pattern for stats/settings overlays).
3. **Recurring:** deferred. DB tables/columns from migration 157 may still exist locally; no API, UI, filter chip, or stats metric. Do not expose until product resumes the feature.
4. **Payments:** ledger table `invoice_payments` is source of truth for `amount_paid` and `paid` / `partially_paid`. Generic invoice create/update **ignores** client `amountPaid` and does **not** apply client-requested `paid` / `partially_paid`; instead `sanitizeClientInvoiceStatus` keeps the invoice’s **current** workflow status (e.g. `sent` stays `sent` — never demoted to `draft`). Create always stores `amount_paid = 0`. After update, `refreshInvoicePaymentState` reconciles denormalized fields from the ledger. Recording/deleting a payment recalculates paid amount and may set status. UI on full invoice view; list chips `unpaid` / partially paid status. Payment mutations: plugin gate + CSRF; `amount` must be greater than 0.
5. **Statistics:** client-side aggregation over loaded invoices (no dedicated stats API), opened via list header like Matches.
6. **Totals:** `lineItems` + `invoiceDiscount` are the money inputs of truth; `resolveInvoiceTotals` / `plugins/invoices/invoiceTotals.js` is the only derivation. Denormalized total columns are a cache; hydrate on API transform + client provider so every surface mirrors the same numbers.

## Consequences

- Local migration `157-invoices-recurring-payments.sql` still required for payments (`amount_paid`, `invoice_payments`). Schedule table may be unused until Recurring resumes.
- Prod migration only on explicit release.
- PDF/public documents unchanged for MVP except existing paid status.
- **Known limitations (Security residual, non-blocking):** lowering invoice `total` via update can make an existing ledger sum cover the total and mark `paid` without a new payment; payment `amount` has no upper bound (overpayment allowed). Status UI “mark paid” without a ledger row does not forge paid on the server.
