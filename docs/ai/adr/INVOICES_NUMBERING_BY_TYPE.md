# ADR: Invoice numbering per document type

**Status:** Accepted  
**Date:** 2026-09-08

## Context

Invoice numbering lived as a single series in `user_settings` category `invoices` (`numberPrefix`, `includeYear`, `numberStart`). Document types (`invoice`, `credit_note`, `cash_invoice`, `receipt`) need independent series.

## Decision

1. **Canonical shape:** `numberingByType: { [invoiceType]: { numberPrefix, includeYear, numberStart } }` for the four types.
2. **Read hydratization:** If `numberingByType` is present, sanitize each type and default missing ones. Otherwise lift flat keys onto `invoice` and default the other types.
3. **Write:** Persist full `numberingByType` and mirror the `invoice` series onto the flat keys so older readers stay consistent under JSONB merge.
4. **Allocation:** `GET /api/invoices/number/next?type=` and create/duplicate pass `invoiceType`. Series identity remains the **number format regex** (not `invoice_type` column). Distinct prefixes separate series in practice.
5. **Defaults:** Empty prefix, `includeYear: true`, `numberStart: 1` for every type — no hard-coded letter prefixes.

## Consequences

- Existing invoice numbers are unchanged.
- Two types with the same prefix + includeYear share one sequence and may collide on unique `invoice_number`; UI shows per-type examples so users can separate prefixes.
- Client and server numbering helpers stay mirrored.
- `GET /api/invoices/number/next?type=` allowlists `type` (`sanitizeInvoiceNumberingType`); unknown values become `invoice`.
- **Follow-up (Security, Low):** create/update should persist `invoice_type` via the same allowlist (as of 2026-09-08 review, body may still write a non-canonical string).
- **Follow-up (Security, Low):** update persist uses `invoiceData.invoiceType || 'invoice'` without falling back to `currentInvoice.invoiceType`, while totals resolution does use that fallback — omitting `invoiceType` on update can desync stored type vs signed totals.
