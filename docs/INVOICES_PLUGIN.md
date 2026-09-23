# Invoices plugin

Swedish invoicing with Facio-style PDF/public documents.

## Document layout (PDF + share link)

Facio-inspired Swedish invoice layout (matches uploaded reference):

- **Header:** logo + company name · document type title (Faktura / Kreditfaktura / Kontantfaktura / Kvitto) + number. PDF page label `X / Y` is a repeating print header (every page, with top margin clearance on continuation pages). Live preview shows `1 / 1` in the document header and dashed **approximate** page-break guides when content exceeds one A4 page.
- **Below header:** customer block left (kund, kundreferens, kundnummer, ordernummer, leveranssätt) · payment summary right (förfallo, summa, referens, bankgiro, then fakturadatum, leveransdatum, betalningsvillkor, dröjsmålsränta).
- **Rule** then line items and totals (summa → fakturarabatt when set → **per-rate VAT rows** when `vatBreakdown` is present → ex moms / moms / summa att betala). Credit notes show **Kredit mot faktura {number}** plus correction summary when set. Supply date appears in the payment-summary / date band when present.
- **Footer (3 columns):** (1) company name + address + F-skatt, with website as a sub-line under the column · (2) Org.nr, VAT-nr, Tel, Mail · (3) payment methods (Bankgiro, Plusgiro, IBAN, BIC, Swish when set). On short single-page PDFs the footer sticks to the bottom of the A4 content box (`min-height: 271mm` + flex); on multi-page documents it follows the content on the last page. Live column preview (`forceDesktop`) drops the A4 min-height so the iframe hugs content (no inner scrollbar); PDF / share window keep A4 fill.

- **Issuer** from Settings → Account (`GET /api/organization`): **logo** (`logoUrl`) + **name**, address, email, phone, website, org-nr, VAT, payment methods, F-tax, interest.
- **Ange referens** (payment summary) = invoice number.
- **Customer** from linked Contact (name, org-nr, preferred address, kundnummer, first contact person as kundreferens when available).
- **Create from Contacts:** when the invoices plugin is enabled, contact **Actions → Invoice** opens create on `/invoices` with that contact prefilled (currency + payment terms).
  - **Provider order:** `ContactProvider` is **outside** `InvoicesProvider` in `PluginProviders` (`reduceRight` registry order). Contacts must **not** call `useInvoices()`.
  - **Bridge:** `requestInvoiceCreateFromContact` in `pendingInvoiceCreate.ts` sets module-scoped pending prefill and notifies subscribers; `InvoicesProvider` subscribes and navigates/opens create (`flushPendingInvoiceCreate`). Pending survives React Strict Mode remount (peek/open, deferred `take`).
  - **App shell:** `AppContent` keeps panels with `panelMode === 'create'` open on the plugin list URL (no slug). `useItemUrl.navigateToBase` only navigates when an item segment is present (avoids no-op `/invoices` → `/invoices` loops).
- **Linked on Contacts:** `ContactLinkedItemsSection` loads invoices via `GET /api/invoices` then filters by `contactId` (same auth privilege as the invoices list; tenant `user_id` via DB adapter). Quick context: max **2** tiles then “X more linked items”; full contact view shows all. Open → `openInvoiceForView` (valid here: Linked section renders under both providers).
- **Leveranssätt** / **Ordernummer** are editable on the invoice form **while draft** and stored on the invoice; shown on the document when set, otherwise `—`. After issue, ML fields are immutable (see [ML VAT compliance](#ml-vat-compliance-epics-ae)).
- **From estimates:** converting an accepted estimate (`POST /api/estimates/:id/convert-to-invoice`) creates a draft invoice with `estimateId` set on the invoice row; see [`ESTIMATES_PLUGIN.md`](ESTIMATES_PLUGIN.md).
- **Language:** Swedish labels.

**Security (2026-09-04 review, contacts↔invoices):** Approved. Prefill/bridge is client UI intent only; create still requires session + plugin gate + CSRF. Linked list fetch does not expand privilege beyond the invoices list. No TPM-accepted residual risks for this slice.

## ML VAT compliance (epics A–E)

Swedish momslag (ML) alignment for domestic invoicing. Design: [`docs/ai/design/INVOICES_ML_VAT_COMPLIANCE_UX.md`](ai/design/INVOICES_ML_VAT_COMPLIANCE_UX.md). Server authority: `plugins/invoices/vatEngine.js`, `mlLock.js`, `model.js`. Client mirrors: `client/src/plugins/invoices/utils/invoiceMlCompliance.ts`.

### Issue lock (leave draft)

- **Draft** (`status === 'draft'`): ML content is editable; soft validation (credit-note link/summary when type is `credit_note`).
- **Issue:** any transition to a non-draft status runs the VAT/content-profile gate, freezes ML fields, and inserts one row into `invoice_issue_snapshots` (`content_hash` + `snapshot_json`; `ON CONFLICT (invoice_id) DO NOTHING`). UI: issue confirm (`InvoiceStatusModal` / Send) warns that content locks.
- **Issued update:** `PUT` never rewrites ML columns. Only workflow status may change via `resolveIssuedStatusTransition` allowlist: `sent` | `overdue` | `canceled`. Client `paid` / `partially_paid` are ignored (ledger owns paid). **`draft` is refused** with **409** `INVOICE_ML_LOCKED`.
- **UI:** Edit/Delete disabled when issued (`InvoiceDetailHeaderMenus`). Status select omits Draft; paid/partially_paid appear only if already current. View status changes send **`{ id, status }` only** (`buildInvoiceStatusUpdatePayload`).
- **Delete:** issued invoices cannot be deleted (`assertDraftDeletable` → 409 `INVOICE_ML_LOCKED`).

### Credit notes (hard link)

- Create path remains **Actions → Create credit note** on an **issued** `invoiceType === 'invoice'` (client `canCreateCreditNoteFromInvoice`; blank create cannot pick `credit_note` as an untied type).
- Payload persists **`creditedInvoiceId`**, **`creditedInvoiceNumber`** (server-owned imprint from original), and **`correctionSummary`** (required). Notes may still mention the original for UX; they are **not** the legal link.
- Server rejects credit notes without a valid issued standard-invoice link (`CREDIT_LINK_REQUIRED`) or empty correction summary (`CORRECTION_SUMMARY_REQUIRED`).
- Totals still use positive line amounts and **negative** signed document totals via `resolveInvoiceTotals`. No automatic payment adjustment on the original.

### Supply date, content profile, VAT

| Concern           | Behavior                                                                                                                                                                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supplyDate`      | Stored; defaults toward issue date when issuing if empty. Shown on form, view, live preview, and PDF (falls back to issue date when empty).                                                                                                             |
| `contentProfile`  | `full` \| `simplified`. `invoice` / `credit_note` always **full**. `receipt` / `cash_invoice` may be **simplified** when currency is SEK and total incl. VAT ≤ **4 000** (`FORENKLAD_TOTAL_CEILING_SEK`); otherwise full / gate error `FORENKLAD_GATE`. |
| Currency at issue | Editable on draft (defaults from contact). Options: SEK / EUR / USD / NOK / DKK.                                                                                                                                                                        |
| Line VAT rates    | Allowlist **0 / 6 / 12 / 25** (same as contact tax rate). Defaults from contact `taxRate` when customer is selected; each line can be changed.                                                                                                          |
| Refused postures  | Reverse charge / exemption / export → `VAT_POSTURE_REFUSED` (no UI to select them in v1).                                                                                                                                                               |
| `vatBreakdown`    | Per-rate `{ rate, taxBase, vatAmount }` cache on save; shown in `InvoicePricingSummary` and PDF/web totals.                                                                                                                                             |

### Schema & migrate

Migration **`164-invoices-ml-vat-compliance.sql`**: `supply_date`, `content_profile`, `credited_invoice_id` (FK `ON DELETE RESTRICT`), `credited_invoice_number`, `correction_summary`, `vat_breakdown`, table `invoice_issue_snapshots`. No hard CHECK that every legacy credit note has a link — application enforces on create/update.  
Script: `npm run migrate:invoices-ml-vat-compliance`. **Local-first; prod only on explicit release.**

**Out of scope (this ship):** bokföringsmässig journal, long retention policy productization, kassaregister — see [`docs/ai/external/LEGAL_ACCOUNTED_INVOICES_REQUEST.md`](ai/external/LEGAL_ACCOUNTED_INVOICES_REQUEST.md).

**QA / Security status (this epic):** QA verified B1/B2 lock fixes in rework; docs gap (B3) addressed here — **re-review still required**. **Security Expert has not approved this epic yet.**

Routes:

| Route                                 | Auth                    | Notes                                                          |
| ------------------------------------- | ----------------------- | -------------------------------------------------------------- |
| `GET /api/invoices/number/next?type=` | Session + plugin gate   | Next number for series; `type` allowlisted (`invoice` default) |
| `GET /api/invoices/:id/pdf`           | Session + plugin gate   | Binary PDF                                                     |
| `GET /api/invoices/public/:token`     | **None** (rate-limited) | JSON for public SPA                                            |
| `/public/invoice/:token`              | Public SPA              | Renders HTML via `generateInvoiceWebHTML` in an iframe         |

Authenticated share management: `POST /api/invoices/shares` (CSRF), `GET /api/invoices/:invoiceId/shares`, `DELETE /api/invoices/shares/:shareId` (CSRF). Tokens are `crypto.randomBytes(24)` (base62). Expired shares (`valid_until`) do not resolve.

### Public JSON payload (current behavior)

`GET /api/invoices/public/:token` returns the invoice transform (after stripping `shareOwnerUserId`) plus the **full** organization object when resolvable (logo embedded as data URI when possible), `customer`, and `referencePerson` (share-owner display name). The public **document UI** displays issuer fields listed above (logo, name, address, email, phone, website, org-nr, VAT-nr, Bankgiro/Plusgiro/IBAN/BIC/Swish when set, F-tax, interest, reference person).

**Security note (2026-08-25 review):** A narrower public DTO (whitelist document fields + limited org) is recommended as a follow-up; not required for current ship. Same iframe sandbox pattern as Estimates (`allow-scripts allow-same-origin` + CDN Tailwind).

## Organization billing fields

Stored in main DB `tenants.organization` JSONB (no new column):

| Field                         | Values                | Default |
| ----------------------------- | --------------------- | ------- |
| `billing.fTax`                | `yes` \| `no`         | `yes`   |
| `billing.latePaymentInterest` | percent string, 0–100 | `12`    |

Edited under Settings → Account → Billing details. Also used: org name, address, email, `billing.organizationNumber`, `billing.vatNumber`, `billing.bankgiro`, etc.

## Auto-overdue

On list/get, invoices with `status = 'sent'` and `due_date < today` are updated to `overdue`. Display also applies the same rule in `transformRow` / status helpers.

## Payment terms → due date

Contact-style day select (`0` / `15` / `30` / `60`). Due date = issue date + days (`invoiceDueDate.ts`). Form due date is read-only (computed); urgency styling mirrors Tasks when status is not paid/canceled.

## List UI

Table-only mail-layout per `docs/UI_AND_UX_STANDARDS_V3.md` §0.1. Due dates use Tasks-style urgency colors (`formatInvoiceDueDate`). Table identity is name/number with type as coded meta; sort includes “Type”.

**No sidebar submenu.** Single nav entry Invoices. Filter chips: **status** (Total, Draft, Sent, Partially paid, Paid, Overdue, Canceled, Unpaid — exclusive within status) plus **document type** (Invoice, Credit note, Cash invoice, Receipt — exclusive within type). Status and type may be combined (AND).

Desktop/pad: row click shows stacked `InvoicesView` in the detail column (`InvoiceQuickContextPanel` is the view header card). There is **no** sticky list-side QC and no `variant="list"`. Compact viewports use panel flow.

List header also opens **Statistics** content view (Matches-style overlay), plus Settings (numbering).

### Invoice numbering settings

Under Invoices → Settings → **Numbering** (`user_settings` category `invoices`):

Canonical key `numberingByType` holds one series per document type (`invoice` | `credit_note` | `cash_invoice` | `receipt`):

| Key (per type) | Type    | Default | Behavior                                                                            |
| -------------- | ------- | ------- | ----------------------------------------------------------------------------------- |
| `numberPrefix` | string  | `''`    | Letters/digits only (max 12). Empty → no letter prefix (UI may still show `INV-…`). |
| `includeYear`  | boolean | `true`  | When true: `PREFIX-YYYY-NNN` or `YYYY-NNN`. When false: `PREFIX-NNN` or `NNN`.      |
| `numberStart`  | int     | `1`     | Minimum sequence for the active series. Next number is `max(last+1, numberStart)`.  |

**Read:** Prefer `numberingByType`; if missing, lift flat `numberPrefix` / `includeYear` / `numberStart` onto type `invoice` and default the other types.  
**Write:** Persist full `numberingByType` and mirror the `invoice` series onto the flat keys.  
**UI:** When Numbering is active, document-type pills sit on a **header submenu row** under Columns/Numbering (`PluginSettingsPageShell.headerSubmenu`, DetailHeaderMenus pattern). Form fields use the full content width (responsive grid). Phone keeps type pills in the body (settings header is `md+` only). Warns when another type shares the same prefix + year flag.  
**Allocation:** `GET /api/invoices/number/next?type=` (default `invoice` via `sanitizeInvoiceNumberingType`; unknown types → `invoice`). Create/duplicate use the document’s `invoiceType`. Series identity is the number-format regex (use distinct prefixes to separate sequences). See ADR `docs/ai/adr/INVOICES_NUMBERING_BY_TYPE.md`.

**Security (2026-09-08 review, numbering epic):** Approved. Numbering `type` is allowlisted; prefix sanitized to `[A-Z0-9]` (max 12); regex uses `escapeRegExp`; create/update mutations keep CSRF + plugin gate. PDF/web document HTML escapes user/org fields. **Superseded follow-ups from that review:** (1) create/update now persist `invoice_type` via `sanitizeInvoiceNumberingType`; (2) credit-note creation is gated on the server (`CREDIT_LINK_REQUIRED` / issued standard invoice + `CORRECTION_SUMMARY_REQUIRED`) in addition to client `canCreateCreditNoteFromInvoice`. Preview iframe `sandbox="allow-scripts allow-same-origin"` is pre-existing (same pattern as Estimates public docs). **ML VAT epic Security:** not yet reviewed (see [ML VAT compliance](#ml-vat-compliance-epics-ae)).

Settings UI field order per type: **Prefix → Year → Start number**, with a checkbox to show/hide year in the allocated number.

Full-view Quick Context (`InvoiceQuickContextPanel`): Contacts-style **header only** (title + status badge + customer/total subtitle + menus + `headerBelow` tab chips). Fact grid (number · type · dates · total · currency · payment terms), status/notes, Share, and **live document preview** live on the **Information** tab as stacked cards — not in the QC body and not as a side column. Line items section is collapsible with **`defaultOpen`**. No Delete, Duplicate, or Export in the QC body (those live in `InvoiceDetailHeaderMenus`). Legacy `InvoicePreviewDialog` / `InvoiceStatusButtons` removed; popup preview remains via `openInvoicePreviewWindow`.

## Full view & edit (plugin view contract)

Aligned with Contacts / Notes / Tasks chrome (see also `docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`). **View and edit are a single stacked column** (no sticky preview side column).

| Mode          | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full view     | Single column: QC header + `?tab=` chips; **Information** stacks fact card + status/notes + Share + **preview** card. Other tabs swap content under the header (no preview). Line items tab: list + pricing; section **open by default**.                                                                                                                                                                                                                                                                                                                          |
| Edit / create | Header card (number + tab chips) always visible. **Information** tab: customer + notes + Invoice Properties + preview. **Lines** tab: line items + discount/pricing (no preview). Payments / Linked / Activity greyed in edit.                                                                                                                                                                                                                                                                                                                                     |
| Duplicate     | `usePluginDuplicate` + `DuplicateDialog`; list row highlight via `recentlyDuplicatedInvoiceId`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Credit note   | Full-view **Actions → Create credit note** when `invoiceType === 'invoice'` **and** the document is **issued** (`canCreateCreditNoteFromInvoice`). Creates a **draft** `credit_note` with the same customer and **positive** line amounts; `resolveInvoiceTotals` signs money totals **negative**. Persists **`creditedInvoiceId` / `creditedInvoiceNumber` / `correctionSummary`** (server-enforced). Number from the `credit_note` series. Opens the new draft in edit. No payment adjustment on the original. Untied blank `credit_note` create is not offered. |
| Share         | Tasks-style: Export → Share creates (or reuses) a 30-day link and opens `ShareDialog` — no valid-until picker. **Export → Email invoice** (mail plugin) ensures the same share link, then opens `BulkEmailDialog` with the customer as recipient, **Settings → Default texts** `invoiceMail` as editable `initialBody` when set, and the public URL attached to the message. Active share panel + public share page include **Download PDF** (`GET /api/invoices/public/:token/pdf`).                                                                              |

**Security (2026-09-23, Email invoice):** Approved. Reuses authenticated share create + mail send (CSRF, plugin gates, high-entropy token). Ensuring the share before the compose dialog opens is the same residual class as Export → Share (cancel without Send leaves an active link; revoke remains available).

**Security (2026-09-23, Default texts):** Approved for `GET/PUT /api/default-texts` (session, tenant scope, CSRF on PUT, role gates). Residual **R1:** `BulkEmailDialog` embeds compose `body` into HTML without escaping (pre-existing; persistent defaults amplify reuse) — awaits TPM accept or FE escape fix. Share-link `additionalHtml` remains escaped via `invoiceShareEmail`.

**Invoice Properties (edit, draft):** Invoice type → Issue date → **Supply date** → Payment terms → Due date (read-only, computed) → Currency (selectable on draft; contact can prefill) → Status. Credit notes also show linked original number + required **Correction summary**. Receipt/cash show derived **Document profile** (`full` / `simplified`).

**Send / issue (draft):** On full view, an **Issue** control appears **before** **Actions** when status is `draft` (`InvoiceDetailHeaderMenus` `beforeActions`). It opens `InvoiceStatusModal` (issue confirm) then saves via `handleStatusChange(…, 'sent')`. Edit/create: change status to Sent in Invoice Properties (`requestStatusChange('sent')`) — persistence still requires Save/Update (then lock + snapshot). Preview row is **Preview** only (no Send beside the document). i18n: `invoices.issue` (+ `issueConfirmTitle` / `Message` / `Help`).

**Status after issue:** Select offers `sent` / `overdue` / `canceled` (plus current `paid` / `partially_paid` if already set — not assignable as a new client status). **Draft is not offered.** Status PUT from view is status-only. Colors: shared `INVOICE_STATUS_COLORS` / `InvoiceStatusSelect`. Delbetalning sätter `partially_paid` via payment ledger.

**Dates:** Issue date (and payments / share valid-until) use shared `DatePicker` (`client/src/core/ui/DatePicker.tsx`), not native `type="date"`.

## Payments

Ledger table `invoice_payments` (amount, paid_on, reference) is the **source of truth** for paid state. Recording a payment updates denormalized `invoices.amount_paid` and sets `status=paid` / `paid_at` when sum ≥ total (`partially_paid` when sum is greater than 0 but below total). Partial payments supported. UI: `InvoicePaymentsBlock` on full view. Status still appears on cards/QC/table; list filter chips cover **status** (with counts) and **document type** (see List UI).

**Ledger vs credit notes:** `derivePaymentStatus` only marks `paid` when `total > 0` and ledger covers it — negative credit-note totals do not forge paid from an empty ledger.

## Totals (single source of truth)

**Inputs of truth:** `lineItems` + `invoiceDiscount` (%).  
**Derivation:** only via `resolveInvoiceTotals` / `calculateInvoiceTotals`  
(`client/.../utils/invoiceTotals.ts`, mirrored by `plugins/invoices/invoiceTotals.js`).  
When `invoiceType === 'credit_note'`, resolved money fields are signed **negative** (line amounts stay positive).  
**Denormalized columns** (`subtotal`, `totalVat`, `total`, …) are a cache written on save with the same function; API `transformRow` and client provider stamp resolved totals so list / QC / full view / preview / PDF / stats never diverge.

Do **not** read raw DB totals for display when line items exist — always go through `resolveInvoiceTotals` (or fields already stamped by `withResolvedInvoiceTotals`).

**Integrity:** Generic invoice create/update does **not** accept client `amountPaid` or client-assigned `paid` / `partially_paid`. On **issued** rows, status allowlist is `sent` / `overdue` / `canceled` only; paid statuses and ML body fields are ignored or rejected as above. Create always starts at `amount_paid = 0`. After update, `refreshInvoicePaymentState` reconciles from the ledger.

API: `GET/POST /api/invoices/:invoiceId/payments`, `DELETE /api/invoices/payments/:paymentId` (plugin gate; CSRF on mutations; POST `amount` must be greater than 0).

**Limitations:** Editing `total` downward on a **draft** can make an existing ledger sum mark the invoice paid after issue; payment amount has no upper cap. Issued ML content cannot be edited in place — use a credit note.

## Recurring

**Paused.** Application surface (API, content view, list chip, stats) removed. Migration 157 may still create `invoice_recurring_schedules` / `recurring_schedule_id` locally; unused until the feature is resumed.

## Statistics

Client-side KPIs (`computeInvoiceStats`) opened from list header → `InvoicesStatisticsView` with shared `StatCharts`. **Money is aggregated per currency** (`byCurrency` / `totalInvoicedByCurrency`) — SEK and EUR are never mixed or FX-converted. Count charts stay global; amount charts and KPIs label each currency. `byType` covers `invoice` | `credit_note` | `cash_invoice` | `receipt` (credit notes use signed totals). Collection donut is single-currency only; multi-currency uses ranked bars.

**Known UI limitation:** QC payment “remaining” uses `Math.max(0, total − paid)`, so credit notes with negative totals do not show a meaningful remaining balance.

## Migrations (local)

- `147-invoices-add-paid-at.sql` — `paid_at`
- `148-invoices-align-schema.sql` — align older tenant tables with expected columns
- `157-invoices-recurring-payments.sql` — payments + `amount_paid` (also creates unused recurring schedule table)
- `159-invoices-status-partially-paid.sql` — status `partially_paid`
- `164-invoices-ml-vat-compliance.sql` — supply date, content profile, credit link, vat breakdown, issue snapshots

Scripts: `npm run migrate:invoices-paid-at`, `migrate:invoices-align-schema`, `migrate:invoices-recurring-payments`, `migrate:invoices-recurring-payments-user-id`, `migrate:invoices-status-partially-paid`, `migrate:invoices-ml-vat-compliance`.  
For local Neon-parity (`TENANT_PROVIDER` unset/`neon` + localhost connection strings), migrations run against the tenant DB `public` schema. Use `TENANT_PROVIDER=local` only when data lives in `tenant_N` schemas. **Prod only on explicit release decision.**

Legacy URLs `/invoices/recurring|payments|reports` map to the invoices list (no stub pages).
