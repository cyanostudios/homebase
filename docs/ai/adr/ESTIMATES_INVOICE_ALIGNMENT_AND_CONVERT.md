# ADR: Estimates invoice alignment and convert-to-invoice

**Status:** Accepted  
**Date:** 2026-09-21

## Context

Estimates predated invoice field parity (order/delivery on documents, rich line items) and had no first-class path from an accepted quote to a draft invoice. Invoices already stored optional `estimate_id`; estimate status did not include a terminal post-conversion state.

## Decision

1. **Field alignment (estimates ↔ invoices, max except payments/types):**
   - Persist **`order_number`** and **`delivery_method`** on `estimates` (migration 162).
   - Line items use the **same shape** as invoices (`InvoiceLineItem`: `kind`, `unit`, text rows, discounts, VAT). Client edit reuses **`InvoiceLineItemsEditor`** via `EstimateLineItemsEditor`; server normalizes with `normalizeEstimateLineItems` and totals via `calculateEstimateTotals` / mirrored invoice totals on convert.
   - **No** payment ledger, **no** invoice multi-type series on estimates.

2. **Status `invoiced` (terminal):**
   - Add `invoiced` to DB check constraint and server allowlist (`ESTIMATE_STATUSES`).
   - Clients **must not** set `invoiced` via `PUT`; only **`POST /api/estimates/:id/convert-to-invoice`** transitions `accepted` → `invoiced`.
   - **`PUT` on an invoiced estimate** is rejected (_Invoiced estimates cannot be edited_).

3. **Convert-to-invoice (server):**
   - Single DB transaction: verify invoices plugin enabled → no existing `invoices.estimate_id` → load estimate with **`status === 'accepted'`** → insert **draft** invoice (`invoice_type = 'invoice'`, copy lines/discount/customer/order/delivery/notes, allocate invoice number) → set `estimate_id` on invoice → set estimate **`invoiced`**.
   - Requires **CSRF** + estimates plugin gate; **403** if invoices plugin disabled for tenant/user.
   - Duplicate link: **409** with `existingInvoiceId` when a row already exists (explicit pre-check).

4. **DB idempotency:**
   - Partial unique index **`idx_invoices_estimate_id_unique`** on `invoices(estimate_id) WHERE estimate_id IS NOT NULL` (migration 162).

5. **Numbering:**
   - Estimate numbers use **`user_settings` category `estimates`** with flat keys **`numberPrefix`**, **`includeYear`**, **`numberStart`** (mirrors invoice flat series helpers in `estimateNumbering.js`, not `numberingByType`).

6. **UI / view contract:**
   - Mail-layout **`EstimateQuickContextPanel`**: Contacts-class **header only** (facts on tabs).
   - Full view/edit tabs: **`information` | `lines` | `linked` | `activity`**. Information stacks facts, properties (status, reasons), **notes**, share, and live **Offert** preview. Linked shows invoice when `invoiced`.
   - Convert action in **`EstimateDetailHeaderMenus`** when `accepted` and invoices enabled.

7. **Local migration delivery:**
   - Ship SQL as **`162-estimates-invoice-alignment.sql`**; run locally via **`npm run migrate:estimates-invoice-alignment`**. Production migration only on explicit release decision (local-first parity workflow).

## Consequences

- Accepted quotes become draft invoices without re-keying line items; estimate becomes read-only for content edits.
- One invoice per estimate enforced in DB; application returns 409 on obvious duplicates.
- **Rejected** estimates remain a valid status but are not convertible; list filters emphasize draft/sent/accepted/invoiced.
- **Security residuals (accepted, documented):** concurrent convert race (500 vs 409); delete not blocked for invoiced estimates; public/PDF may show `invoiced` status; settings category trust model unchanged.

## Verification sources

- `server/migrations/162-estimates-invoice-alignment.sql`
- `plugins/estimates/model.js` (`update`, `convertToInvoice`)
- `plugins/estimates/routes.js`, `estimateStatus.js`, `estimateNumbering.js`
- `client/src/plugins/estimates/components/EstimateView.tsx`, `EstimateQuickContextPanel.tsx`, `EstimateLineItemsEditor.tsx`, `EstimateSettingsView.tsx`
- Tests: `plugins/estimates/__tests__/model.convert.test.js`, `estimateStatus.test.js`, client tab/edit parity tests
