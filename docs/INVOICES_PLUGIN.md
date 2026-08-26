# Invoices plugin

Swedish invoicing with Facio-style PDF/public documents.

## Document layout (PDF + share link)

Facio-inspired Swedish invoice layout (matches uploaded reference):

- **Header:** issuer (left) · “Faktura” + label/value rows (förfallo, summa, referens, Bankgiro) and customer address (right).
- **Meta strip** between light-blue rules: fakturanummer, fakturadatum, kund, betalningsvillkor, referens, dröjsmålsränta.
- **Line items** then totals (ex moms / moms / summa att betala).
- **Footer:** issuer contact + Org-nr / VAT-nr / Bankgiro / F-skatt.

- **Issuer** from Settings → Account (`GET /api/organization`): **logo** (`logoUrl`) + **name**, address, email, org-nr, VAT, Bankgiro, F-tax, interest.
- **Referens** (meta strip + issuer person line) = account user display name derived from the session / share-owner email local-part (users have no separate name column).
- **Ange referens** (payment summary) = invoice number.
- **Customer** from linked Contact (name, org-nr, preferred address when available).
- **Language:** Swedish labels.

Routes:

| Route                             | Auth                    | Notes                                                  |
| --------------------------------- | ----------------------- | ------------------------------------------------------ |
| `GET /api/invoices/:id/pdf`       | Session + plugin gate   | Binary PDF                                             |
| `GET /api/invoices/public/:token` | **None** (rate-limited) | JSON for public SPA                                    |
| `/public/invoice/:token`          | Public SPA              | Renders HTML via `generateInvoiceWebHTML` in an iframe |

Authenticated share management: `POST /api/invoices/shares` (CSRF), `GET /api/invoices/:invoiceId/shares`, `DELETE /api/invoices/shares/:shareId` (CSRF). Tokens are `crypto.randomBytes(24)` (base62). Expired shares (`valid_until`) do not resolve.

### Public JSON payload (current behavior)

`GET /api/invoices/public/:token` returns the invoice transform (after stripping `shareOwnerUserId`) plus the **full** organization object when resolvable (logo embedded as data URI when possible), `customer`, and `referencePerson` (share-owner display name). The public **document UI** only displays issuer fields listed above (logo, name, address, email, org-nr, VAT-nr, Bankgiro, F-tax, interest, reference person); it does not render IBAN/BIC/Swish/phone even if present in JSON.

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

Card-column shell per `docs/UI_AND_UX_STANDARDS_V3.md` §0.1 (cards + table). Due dates use Tasks-style urgency colors (`formatInvoiceDueDate`).

Desktop/pad: row click opens sticky **Quick Context** (`InvoiceQuickContextPanel` via `useQuickContextPreview`); compact viewports open full view.

List Quick Context (`variant="list"`): Contacts-style header + fact grid; **item count only** (no line-item rows); notes callout when present; footer “Open full invoice”. No Delete, Duplicate, or Export in the panel.

## Full view & edit (plugin view contract)

Aligned with Contacts / Notes / Tasks chrome (see also `docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`). **Edit layout follows Contacts 2-column pattern** (not the guide’s older “Information sidebar in edit” row — that guide row is outdated for Contacts-class plugins).

| Mode          | Behavior                                                                                                                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full view     | 3 columns like Contacts: (1) Quick Context + line items / pricing / notes, (2) Properties + Relations + Share, (3) Quick Actions → Export → Information → Activity.                                                                   |
| Edit / create | **2 columns** via `DetailLayout leftSidebar` + main: left = customer identity, notes, line items, discount, pricing; main = Invoice Properties + inline green Save / Cancel. **No** Information or Activity in edit (full view only). |
| Duplicate     | `usePluginDuplicate` + `DuplicateDialog`; list row highlight via `recentlyDuplicatedInvoiceId`                                                                                                                                        |
| Share         | Create via AlertDialog (valid-until); result / view via shared `ShareDialog` (`variant="invoice"`)                                                                                                                                    |

Status colors: shared `INVOICE_STATUS_COLORS` / `InvoiceStatusSelect` (draft gray, sent blue, paid green, overdue/canceled rose).

## Migrations (local)

- `147-invoices-add-paid-at.sql` — `paid_at`
- `148-invoices-align-schema.sql` — align older tenant tables with expected columns

Scripts: `npm run migrate:invoices-paid-at`, `npm run migrate:invoices-align-schema` (see `package.json`). **Prod only on explicit release decision.**
