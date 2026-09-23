# Estimates plugin

Swedish **Offert** documents with invoice-aligned fields and line items, Facio-style PDF/public preview, and convert-to-invoice from **accepted** estimates.

**Not in scope (by design):** invoice payment ledger, invoice document types (`credit_note`, `cash_invoice`, `receipt`), or per-type invoice numbering — see [`INVOICES_PLUGIN.md`](INVOICES_PLUGIN.md).

## Document layout (PDF + share link)

Same **Facio** Swedish document chrome as invoices (`plugins/invoices/pdfTemplate.js` / `webTemplate.ts`), with Offert semantics:

- **Title:** **Offert** + estimate number (`plugins/estimates/pdfTemplate.js`, `client/src/plugins/estimates/webTemplate.ts`).
- **Top payment panel:** **Giltig t.o.m.**, **Offertsumma**, **Ange referens** (estimate number) — no bankgiro / “Summa att betala”.
- **Right meta:** **Offertedatum**, **Giltig t.o.m.** — no payment terms / late interest.
- **Customer block:** name, org-nr, address from Contacts when linked; **Kundreferens**, **Kundnummer**, **Ordernummer**, **Leveranssätt**.
- **Line items:** `kind` (`item` | `text`) and `unit`; text rows are description-only (colspan).
- **Totals:** `Offertrabatt` when set; grand total label **Offertsumma**. Math via `calculateEstimateTotals` / `resolveEstimateTotals`.
- **Issuer footer:** organization from Settings → Account (logo, address, org/VAT, payment details) — same as invoices.
- **Live preview:** `EstimateDocumentPreview` (`forceDesktop`) on the full view **Information** tab; PDF via `GET /api/estimates/:id/pdf` (same Puppeteer page-label margins as invoices).

Public share: `/public/estimate/:token` opens `PublicEstimateView` with an invoices-style top header (customer — number, Giltig t.o.m., status, **Ladda ner PDF**) above the Facio document iframe. JSON via rate-limited `GET /api/estimates/public/:token` (includes org/customer); PDF via `GET /api/estimates/public/:token/pdf`.

## Routes

| Route                                        | Auth                             | Notes                                               |
| -------------------------------------------- | -------------------------------- | --------------------------------------------------- |
| `GET /api/estimates/number/next`             | Session + plugin gate            | Next estimate number from user settings             |
| `GET /api/estimates/:id/pdf`                 | Session + plugin gate            | Binary PDF                                          |
| `GET /api/estimates/public/:token`           | **None** (rate-limited)          | Public estimate JSON (+ org/customer for Facio doc) |
| `GET /api/estimates/public/:token/pdf`       | **None** (rate-limited)          | Binary Offert PDF                                   |
| `POST /api/estimates/:id/convert-to-invoice` | Session + plugin gate + **CSRF** | Creates draft invoice; sets estimate `invoiced`     |

Sharing (authenticated): `POST /api/estimates/shares` (CSRF), `GET /api/estimates/:estimateId/shares`, `DELETE /api/estimates/shares/:shareId` (CSRF). Export → Share is **Tasks-style** (reuse active link or create with 30-day default → `ShareDialog`); no valid-until picker. **Export → Email estimate** (mail plugin) ensures/reuses the share link, opens `BulkEmailDialog` with the customer as recipient, **Settings → Default texts** `estimateMail` as editable `initialBody` when set, and the public URL attached (same BulkEmailDialog / residual **R1** HTML-body class as invoices — see [`INVOICES_PLUGIN.md`](INVOICES_PLUGIN.md) Default texts security note).

## Status model

Allowlist (`plugins/estimates/estimateStatus.js`): `draft` | `sent` | `accepted` | `rejected` | **`invoiced`**.

| Status               | Notes                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `draft` … `rejected` | Client may set via normal update (with acceptance/rejection reason flows where applicable).                                        |
| **`invoiced`**       | **Terminal.** Set only by **`convert-to-invoice`**. Manual `status: invoiced` on `PUT` is rejected (`assertClientEstimateStatus`). |

**Invoiced estimates cannot be edited:** `EstimateModel.update` returns 400 _Invoiced estimates cannot be edited_. Client also blocks Edit when `status === 'invoiced'` (`EstimateProvider.openEstimateForEdit`, `EstimateDetailHeaderMenus`).

**UI:** `invoiced` appears in status badge colors and list filter chips; it is **excluded** from the status dropdown (`EstimateStatusSelect`).

## Convert to invoice

**Endpoint:** `POST /api/estimates/:id/convert-to-invoice` (`plugins/estimates/routes.js`).

**Preconditions (server):**

1. **Invoices plugin enabled** for the tenant/user (`pluginAccess.isPluginEnabledForRequest`) — otherwise **403**.
2. Estimate **status must be `accepted`** — otherwise **400**.
3. No existing row in `invoices` with this `estimate_id` — otherwise **409** with `existingInvoiceId` (pre-check before insert).

**Transaction (`EstimateModel.convertToInvoice`):**

- Inserts a **draft** `invoice` (`invoice_type = 'invoice'`, `status = 'draft'`, `amount_paid = 0`) copying customer, currency, line items, estimate discount → invoice discount, notes, **order_number**, **delivery_method**, and denormalized totals from `calculateInvoiceTotals`.
- Sets `invoices.estimate_id` to the source estimate.
- Updates estimate to **`invoiced`** with `status_changed_at`.
- Allocates invoice number inside the transaction via invoice numbering helpers.
- Response **201:** `{ estimate, invoice }`.

**UI:** Actions → **Convert to invoice** when `accepted` and invoices plugin enabled (`EstimateDetailHeaderMenus`); confirm dialog explains the estimate will be marked invoiced and no longer editable.

**Linked tab:** When `status === 'invoiced'` and invoices are enabled, `useEstimateLinkedInvoice` resolves the invoice from `GET /api/invoices` by matching `estimateId`.

**Idempotency:** Partial unique index `idx_invoices_estimate_id_unique` on `invoices(estimate_id) WHERE estimate_id IS NOT NULL` (migration 162). Application-level duplicate check returns 409; concurrent converts may still surface as **500** if both pass the pre-check (see Security).

## List UI

Table-only mail-layout (same family as invoices/contacts). Filter chips: **Draft**, **Sent**, **Accepted**, **Invoiced** (status; `rejected` has no dedicated chip — still visible when no filter or via search). List header opens **Statistics** and **Settings** (numbering).

Desktop/pad: row click → stacked `EstimateView` in the detail column. **`EstimateQuickContextPanel`** is header-only (number, status badge, customer + total subtitle, menus, optional tab chips in `headerBelow`); facts and preview live on tabs, not in the QC body.

## Full view & edit (plugin view contract)

Aligned with Contacts-class chrome; see [`PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md).

**URL tabs (`?tab=`):** `information` | `lines` | `linked` | `activity` (`EstimateView` / `EstimateForm`). Default / omitted `tab` = **information**.

| Tab             | Full view content                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Information** | Fact card (number, valid to, total, currency, order number, delivery method) → **Estimate properties** card (status select, acceptance/rejection reasons, **notes** callout when set) → Share → **live document preview** |
| **Lines**       | Line item list (invoice line row styles) + pricing summary; section **open by default**                                                                                                                                   |
| **Linked**      | Linked invoice tile when invoiced (+ invoices plugin)                                                                                                                                                                     |
| **Activity**    | `DetailActivityLog` (`entityType="estimate"`)                                                                                                                                                                             |

| Mode          | Behavior                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Full view     | QC header + tab chips; tab panels below (stacked column, no sticky preview side column)                   |
| Edit / create | Same tab shell; **Linked** and **Activity** greyed/disabled in edit; invoiced estimates cannot enter edit |
| Duplicate     | `usePluginDuplicate` + `DuplicateDialog` (header menus)                                                   |

**Line items (edit):** `EstimateLineItemsEditor` wraps **`InvoiceLineItemsEditor`** — shared `kind`, `unit`, text rows, and move/duplicate behavior.

**Order number / delivery method:** Editable on the form (Information tab properties area); persisted on the estimate and shown on PDF/preview when set.

## Estimate numbering settings

Under Estimates → Settings → **Numbering** (`user_settings` category **`estimates`**, key constant `ESTIMATES_SETTINGS_KEY`):

| Key            | Type    | Default | Behavior                                                                                                  |
| -------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------- |
| `numberPrefix` | string  | `''`    | Sanitized like invoice flat series (letters/digits, max 12)                                               |
| `includeYear`  | boolean | `true`  | `PREFIX-YYYY-NNN` vs `PREFIX-NNN` (via shared `resolveInvoiceNumbering` mirror in `estimateNumbering.js`) |
| `numberStart`  | int     | `1`     | Minimum sequence; next = `max(last+1, numberStart)`                                                       |

**Allocation:** `GET /api/estimates/number/next`. Create uses the next number from settings.

## Totals (single source of truth)

**Inputs:** `lineItems` + `estimateDiscount` (%).  
**Derivation:** `resolveEstimateTotals` / `calculateEstimateTotals` only.  
Denormalized DB columns on `estimates` are written on save with the same function; display should use resolved totals, not ad-hoc math.

## Migrations (local)

- **`162-estimates-invoice-alignment.sql`** — `order_number`, `delivery_method`; status check includes `invoiced`; partial unique index on `invoices.estimate_id`.

**Script:** `npm run migrate:estimates-invoice-alignment` (`scripts/run-estimates-invoice-alignment-migration.js`) — runs 162 on all tenant DBs (same tenant discovery pattern as other multi-tenant migration scripts). **Prod only on explicit release decision.**

## Security (2026-09-21 review — residual risks, TPM-accepted)

Approved with the following **documented** follow-ups:

| ID     | Risk                              | Notes                                                                                                                                                                                                                                 |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1** | Concurrent **convert-to-invoice** | Two requests may both pass the pre-insert `SELECT`; second insert can hit the unique index and surface **500** instead of **409**.                                                                                                    |
| **R2** | **Delete invoiced estimate**      | `DELETE /api/estimates/:id` and bulk delete do **not** block `invoiced`; invoice row may remain with `estimate_id` pointing at a removed estimate (DB FK on estimate side depends on tenant schema — delete is not guarded in model). |
| **R3** | **Public / PDF status exposure**  | **Mitigated (Facio Offert):** PDF/web templates no longer render estimate status on the document (same as invoices). Status remains in authenticated UI only.                                                                         |
| **R4** | **Settings keys**                 | Numbering lives under category `estimates` with flat keys; same trust model as other `user_settings` categories (session + tenant user).                                                                                              |

Convert requires CSRF on POST, plugin gate, and invoices plugin enablement check. Invoiced immutability is enforced on **update**, not on delete.

## Related docs

- [`INVOICES_PLUGIN.md`](INVOICES_PLUGIN.md) — payments, invoice types, numbering by type, `estimateId` on invoices created from estimates.
- ADR [`docs/ai/adr/ESTIMATES_INVOICE_ALIGNMENT_AND_CONVERT.md`](ai/adr/ESTIMATES_INVOICE_ALIGNMENT_AND_CONVERT.md)
