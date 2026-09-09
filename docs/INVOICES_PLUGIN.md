# Invoices plugin

Swedish invoicing with Facio-style PDF/public documents.

## Document layout (PDF + share link)

Facio-inspired Swedish invoice layout (matches uploaded reference):

- **Header:** logo + company name · document type title (Faktura / Kreditfaktura / Kontantfaktura / Kvitto) + number. PDF page label `X / Y` is a repeating print header (every page, with top margin clearance on continuation pages). Live preview shows `1 / 1` in the document header and dashed **approximate** page-break guides when content exceeds one A4 page.
- **Below header:** customer block left (kund, kundreferens, kundnummer, ordernummer, leveranssätt) · payment summary right (förfallo, summa, referens, bankgiro, then fakturadatum, betalningsvillkor, dröjsmålsränta).
- **Rule** then line items and totals (summa → fakturarabatt when set → ex moms / moms / summa att betala).
- **Footer (3 columns):** (1) company name + address + F-skatt, with website as a sub-line under the column · (2) Org.nr, VAT-nr, Tel, Mail · (3) payment methods (Bankgiro, Plusgiro, IBAN, BIC, Swish when set). On short single-page PDFs the footer sticks to the bottom of the A4 content box (`min-height: 271mm` + flex); on multi-page documents it follows the content on the last page. Live column preview (`forceDesktop`) drops the A4 min-height so the iframe hugs content (no inner scrollbar); PDF / share window keep A4 fill.

- **Issuer** from Settings → Account (`GET /api/organization`): **logo** (`logoUrl`) + **name**, address, email, phone, website, org-nr, VAT, payment methods, F-tax, interest.
- **Ange referens** (payment summary) = invoice number.
- **Customer** from linked Contact (name, org-nr, preferred address, kundnummer, first contact person as kundreferens when available).
- **Create from Contacts:** when the invoices plugin is enabled, contact **Actions → Invoice** opens create on `/invoices` with that contact prefilled (currency + payment terms).
  - **Provider order:** `ContactProvider` is **outside** `InvoicesProvider` in `PluginProviders` (`reduceRight` registry order). Contacts must **not** call `useInvoices()`.
  - **Bridge:** `requestInvoiceCreateFromContact` in `pendingInvoiceCreate.ts` sets module-scoped pending prefill and notifies subscribers; `InvoicesProvider` subscribes and navigates/opens create (`flushPendingInvoiceCreate`). Pending survives React Strict Mode remount (peek/open, deferred `take`).
  - **App shell:** `AppContent` keeps panels with `panelMode === 'create'` open on the plugin list URL (no slug). `useItemUrl.navigateToBase` only navigates when an item segment is present (avoids no-op `/invoices` → `/invoices` loops).
- **Linked on Contacts:** `ContactLinkedItemsSection` loads invoices via `GET /api/invoices` then filters by `contactId` (same auth privilege as the invoices list; tenant `user_id` via DB adapter). Quick context: max **2** tiles then “X more linked items”; full contact view shows all. Open → `openInvoiceForView` (valid here: Linked section renders under both providers).
- **Leveranssätt** / **Ordernummer** are editable on the invoice form and stored on the invoice; shown on the document when set, otherwise `—`.
- **Language:** Swedish labels.

**Security (2026-09-04 review, contacts↔invoices):** Approved. Prefill/bridge is client UI intent only; create still requires session + plugin gate + CSRF. Linked list fetch does not expand privilege beyond the invoices list. No TPM-accepted residual risks for this slice.

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

Card-column shell per `docs/UI_AND_UX_STANDARDS_V3.md` §0.1 (cards + table). Due dates use Tasks-style urgency colors (`formatInvoiceDueDate`). Table includes an **Invoice type** column (`invoiceType`) by default (after number); card rows show a type badge. Sortable via list sort “Type”.

**No sidebar submenu.** Single nav entry Invoices. Filter chips: Total, Invoice, Credit note, Cash invoice, Receipt (document type; exclusive).

Desktop/pad: row click opens sticky **Quick Context** (`InvoiceQuickContextPanel` via `useQuickContextPreview`); compact viewports open full view.

List header also opens **Statistics** content view (Matches-style overlay), plus Settings (columns + numbering).

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

**Security (2026-09-08 review, this epic):** Approved. Numbering `type` is allowlisted; prefix sanitized to `[A-Z0-9]` (max 12); regex uses `escapeRegExp`; create/update mutations keep CSRF + plugin gate. PDF/web document HTML escapes user/org fields. **Follow-ups (Low, not TPM-accepted residual — recommended hardenings):** (1) persist `invoice_type` via `sanitizeInvoiceNumberingType` on create/update (today raw body / `|| 'invoice'`); (2) on update, align persisted `invoice_type` with the totals fallback chain (`invoiceData.invoiceType || currentInvoice.invoiceType || 'invoice'`) so omitting the field cannot demote a stored credit note to `invoice` while totals still use the current type. **Info:** “Create credit note” eligibility is **client-only** (`canCreateCreditNoteFromInvoice`); the API does not separately gate credit-note creation from an original invoice. Preview iframe `sandbox="allow-scripts allow-same-origin"` is pre-existing (same pattern as Estimates public docs).

Settings UI field order per type: **Prefix → Year → Start number**, with a checkbox to show/hide year in the allocated number.

List Quick Context (`variant="list"`): Contacts-style header with **status badge beside the title** + fact grid (**number · type · issue date · due date · …**); **item count only** (no line-item rows); notes callout when present; footer “Open full invoice”. No Delete, Duplicate, or Export in the panel. Same fact order and header status placement in full-view QC (`variant="full"`).

## Full view & edit (plugin view contract)

Aligned with Contacts / Notes / Tasks chrome (see also `docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`). **Edit layout follows Contacts 2-column pattern**.

| Mode          | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full view     | **2 columns** (50/50) via `DetailLayout`: left = Quick Context (`variant="full"`) + status + notes + line items + pricing + **Payments** + Relations + Share; right = sticky live **preview** only. No Properties card. No Information / Activity system sections.                                                                                                                                                                                                                                                                             |
| Edit / create | **2 columns** via `DetailLayout`: left stack = customer, notes, **Invoice Properties**, line items, then a 2-col grid with **Invoice Discount** + **Pricing Summary** (left) and live **preview** (right). Discount is **not** inside Properties. Pricing Summary is always shown (including zero line items). **Preview** opens the shared-style document in a new window.                                                                                                                                                                    |
| Duplicate     | `usePluginDuplicate` + `DuplicateDialog`; list row highlight via `recentlyDuplicatedInvoiceId`                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Credit note   | Full-view **Actions → Create credit note** (UI only when `invoiceType === 'invoice'` via `canCreateCreditNoteFromInvoice` — **not** enforced as a separate server gate). Creates a **draft** `credit_note` with the same customer and **positive** line amounts; `resolveInvoiceTotals` signs money totals **negative** (list, preview, PDF, denormalized DB cache, statistics). Number from the `credit_note` series; notes “Credit against invoice …”. Opens the new draft in edit. No DB link field; no payment adjustment on the original. |
| Share         | Create via AlertDialog (valid-until); result / view via shared `ShareDialog` (`variant="invoice"`). Active share panel + public share page include **Download PDF** (`GET /api/invoices/public/:token/pdf`).                                                                                                                                                                                                                                                                                                                                   |

**Invoice Properties (edit) field order:** Invoice type → Issue date → Payment terms → Due date (read-only, computed) → Currency → Status.

**Send (draft):** On full view and edit/create preview actions, a **Send** control appears when status is `draft`. View: `handleStatusChange(…, 'sent')` (confirmation modal, then `saveInvoice`). Edit/create: `requestStatusChange('sent')` opens the same `InvoiceStatusModal`; on confirm, form `status` becomes `sent` only — persistence still requires Save/Update. Status select on the form uses the same confirm path for any non-draft status. i18n: `invoices.send`.

Status colors: shared `INVOICE_STATUS_COLORS` / `InvoiceStatusSelect` (draft gray, sent blue, partially paid amber, paid green, overdue/canceled rose). Delbetalning sätter status `partially_paid` automatiskt via payment ledger.

**Dates:** Issue date (and payments / share valid-until) use shared `DatePicker` (`client/src/core/ui/DatePicker.tsx`), not native `type="date"`.

## Payments

Ledger table `invoice_payments` (amount, paid_on, reference) is the **source of truth** for paid state. Recording a payment updates denormalized `invoices.amount_paid` and sets `status=paid` / `paid_at` when sum ≥ total (`partially_paid` when sum is greater than 0 but below total). Partial payments supported. UI: `InvoicePaymentsBlock` on full view. Status still appears on cards/QC/table; **list filter chips are document type**, not payment status (see List UI).

**Ledger vs credit notes:** `derivePaymentStatus` only marks `paid` when `total > 0` and ledger covers it — negative credit-note totals do not forge paid from an empty ledger.

## Totals (single source of truth)

**Inputs of truth:** `lineItems` + `invoiceDiscount` (%).  
**Derivation:** only via `resolveInvoiceTotals` / `calculateInvoiceTotals`  
(`client/.../utils/invoiceTotals.ts`, mirrored by `plugins/invoices/invoiceTotals.js`).  
When `invoiceType === 'credit_note'`, resolved money fields are signed **negative** (line amounts stay positive).  
**Denormalized columns** (`subtotal`, `totalVat`, `total`, …) are a cache written on save with the same function; API `transformRow` and client provider stamp resolved totals so list / QC / full view / preview / PDF / stats never diverge.

Do **not** read raw DB totals for display when line items exist — always go through `resolveInvoiceTotals` (or fields already stamped by `withResolvedInvoiceTotals`).

**Integrity:** Generic invoice create/update does **not** accept client `amountPaid` or client-assigned `paid` / `partially_paid`. Rejected payment statuses keep the invoice’s current workflow status (e.g. `sent`). Create always starts at `amount_paid = 0`. After update, `refreshInvoicePaymentState` reconciles from the ledger.

API: `GET/POST /api/invoices/:invoiceId/payments`, `DELETE /api/invoices/payments/:paymentId` (plugin gate; CSRF on mutations; POST `amount` must be greater than 0).

**Limitations:** Editing `total` downward can make an existing ledger sum mark the invoice paid; payment amount has no upper cap. Marking paid in status UI without recording a payment does not change paid state on the server.

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

Scripts: `npm run migrate:invoices-paid-at`, `migrate:invoices-align-schema`, `migrate:invoices-recurring-payments`, `migrate:invoices-recurring-payments-user-id`, `migrate:invoices-status-partially-paid`.  
For local Neon-parity (`TENANT_PROVIDER` unset/`neon` + localhost connection strings), migrations run against the tenant DB `public` schema. Use `TENANT_PROVIDER=local` only when data lives in `tenant_N` schemas. **Prod only on explicit release decision.**

Legacy URLs `/invoices/recurring|payments|reports` map to the invoices list (no stub pages).
