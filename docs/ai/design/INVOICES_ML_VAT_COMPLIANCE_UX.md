# Design Package — Invoices ML VAT compliance UX (epics A–E)

**Status:** Grind 3 design (proposed)  
**Date:** 2026-09-22  
**Baseline:** TPM Grind 1 decision package (approved) + Solution Architect Grind 2 Output Contract  
**Surfaces:** `InvoicesForm`, `InvoicesView`, `InvoiceDetailHeaderMenus`, `InvoiceLineItemsEditor`, `InvoicePricingSummary`, PDF/web preview, credit-note create flow  
**Guides:** [`docs/PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`](../../PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md), [`docs/UI_AND_UX_STANDARDS_V3.md`](../../UI_AND_UX_STANDARDS_V3.md)

---

## Användarmål

En användare som fakturerar i Sverige ska kunna:

1. Redigera fritt i **utkast**, sedan **utfärda** med tydlig låsning.
2. Rätta materialfel via **kreditnota** kopplad till originalets löpnummer — inte genom tyst redigering.
3. Se **leveransdatum**, **moms per sats**, och om dokumentet är **fullständigt** eller **förenklat**.
4. Betala / dela / ladda ner PDF för utfärdade dokument utan att kunna ändra ML-innehåll.
5. Få begripliga fel när SEK/momssats/förenklad-gräns eller vägrad momsställning blockerar utfärdande.

---

## 1. Användarflöde

### A — Draft → Issue → Locked

```text
Create / Edit draft (full ML fields editable)
  → Save as draft (soft validation OK)
  → Issue: status → non-draft (Send button or status change to sent)
  → ConfirmDialog (warning): “Issue this document? Content will be locked and an archive copy stored.”
  → On success: leave edit → view; ML fields read-only forever
  → Payments / Share / PDF remain on view
```

**Why confirm:** Leaving draft is irreversible for ML content (architect issue pipeline + snapshot). Matches severity of Estimates “convert to invoice” confirm, not a silent status toggle.

**After issue:**

| Action             | Affordance                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Edit               | **Disabled** in Actions (Estimates `invoiced` pattern). Tooltip / TransientActionHint on click of disabled Edit: “Issued documents cannot be edited. Create a credit note to correct.”                  |
| Delete             | **Hidden or disabled** (architect: reject non-draft delete). Prefer **disabled** with same hint pattern so the control is discoverable.                                                                 |
| Duplicate          | Still allowed (creates new draft).                                                                                                                                                                      |
| Create credit note | Allowed when `invoiceType === 'invoice'` and original is issued (keep existing eligibility; strengthen confirm copy).                                                                                   |
| Payments           | **Payments** tab only — unchanged `InvoicePaymentsBlock`.                                                                                                                                               |
| Status             | Paid / partially_paid from payments ledger only (no ML rewrite). `sent`↔`overdue` may remain system/auto. `canceled`: keep existing status control on **view** if already present; do not reopen form. |
| PDF / Share        | Unchanged placement; PDF is archived copy (no separate “regen” label in MVP unless backend exposes a legacy flag — then show muted helper “Archived at issue”).                                         |

**Do not** open edit mode for issued docs with greyed fields. That invites failed saves (409). Block at Actions like Estimates.

**409 `INVOICE_ML_LOCKED`:** If a stale client still posts an update, show existing cannot-save error card / toast with i18n: “This document is issued and cannot be changed.”

### B — Credit note from invoice

```text
View issued invoice → Actions → Create credit note
  → ConfirmDialog (existing): update copy to mention linked original number + required correction summary
  → Opens create form as credit_note draft with:
       creditedInvoiceId (hidden)
       creditedInvoiceNumber (read-only fact)
       correctionSummary (required ghost textarea, empty for user to fill)
       lines prefilled (editable while draft)
  → User fills correction summary → Save draft / Issue
```

**Form Information card (credit_note only):**

1. Read-only row: **Credits invoice** → original running number (link opens original in view if same plugin navigation exists; else plain text).
2. **Correction summary** — required; placeholder e.g. “What changed vs the original invoice?”; maps to `correctionSummary` (not notes-only).
3. Notes remain optional free text; do **not** treat notes as the legal link.

**PDF / preview:** Show a clear line under document type / near header: “Kredit mot faktura {number}” + correction summary block (Designer placement: payment-summary column or notes band — keep Facio layout; one dedicated labeled block, not buried only in notes).

**Untied credit notes:** No create path. Document-type picker must not allow choosing `credit_note` from a blank create without an original (hide or disable type option; credit notes only via Actions on an invoice).

### C — Full vs förenklad

- `invoice` / `credit_note`: always full. No profile control.
- `receipt` / `cash_invoice`: system derives `contentProfile`:
  - SEK and total incl. VAT ≤ 4 000 → may be **Förenklad**
  - else → **Fullständig** (or block issue until full fields present)

**UI:**

- On Information card: read-only **Document profile** chip/text: `Förenklad` | `Fullständig` (derived; not a free toggle).
- When type is receipt/cash and total would exceed gate while profile would be simplified: inline validation (warning→blocking on issue): “Over 4 000 SEK incl. VAT — full invoice fields required” / cannot issue as simplified.
- No marketing claim about kassaregister.

### D — Supply date, VAT, currency

**Supply date (`supplyDate`):**

- Information grid next to Issue date (same ghost date control pattern as issue date).
- Label: “Supply date” / “Leveransdatum”.
- Helper under field (muted `text-xs`): “Defaults to issue date if empty when you issue.”
- Required at issue (client mirror); empty at leave-draft → server defaults; show the resolved date on view after issue.

**Currency:**

- v1: **SEK only** in the currency control (single value or disabled select showing SEK). Selecting other currencies blocked with inline error `CURRENCY_NOT_SUPPORTED` copy.

**Line VAT rates:**

- `InvoiceLineItemsEditor`: VAT control = **select** `{25, 12, 6, 0}` only (remove free numeric that allows arbitrary rates).
- Optional line `vatCategory` for food window: **out of primary chrome** unless product already has category — if implemented, a compact optional select “Category: General | Food” on the line; food outside window → validation error on issue. Prefer General default; do not invent RC/exemption UI.

**Refuse RC / exemption / export:**

- No UI to select those postures in v1.
- If API returns `VAT_POSTURE_REFUSED`, show cannot-save list item with clear copy: “This VAT treatment is not supported yet.”

**Pricing summary + PDF:**

- Extend `InvoicePricingSummary`: after subtotal/discount blocks, before single “Total VAT”, list rows:

  ```text
  VAT 25% on {taxBase}     {vatAmount}
  VAT 12% on {taxBase}     {vatAmount}
  …
  Total VAT                {totalVat}
  Total                    {total}
  ```

- Same breakdown on document preview/PDF totals section (Facio: under line table). Omit zero-rate rows with 0 tax base.

### E — Archive (user-visible)

- No separate “Archive” screen in MVP.
- Issue confirm mentions archive copy.
- Download PDF on issued docs = archived bytes (same menu item). Optional muted subtitle only if product needs to distinguish legacy unrearchived rows later.

---

## 2. Gränssnittsunderlag (wireframe text)

### View header (issued)

```text
[QC header: number · type · status badge · customer · total]
Actions: [Edit disabled] [Delete disabled] [Duplicate] [Credit note?] …
Export: [PDF] [Share]
Tabs: Information | Lines | Payments | Linked | Activity
```

Information fact grid adds: Supply date · Document profile (if receipt/cash) · Credits invoice (if credit_note) · Correction summary (view text).

### Form Information (draft)

```text
Type | Number | Status
Issue date | Supply date | Due (derived)
Currency (= SEK) | Payment terms | …
Customer block (editable in draft)
[credit_note only] Credits invoice (RO) | Correction summary (required)
…
Preview card + [Send] → issue confirm
```

### Lines tab

Dense line editor (existing filled chrome) + VAT select 25/12/6/0 + pricing summary with per-rate rows.

### Confirm — Issue

- `ConfirmDialog` `variant="warning"`
- Title: “Issue document?”
- Body: “After issuing, invoice content cannot be edited. A locked archive copy will be stored. Use a credit note to correct.”
- Confirm: “Issue” / Cancel: continue editing

### Confirm — Credit note

- Keep structure; update body to: “Creates a draft credit note linked to invoice {number}. You must describe what changed before issuing.”

### Error presentation

- Reuse form red cannot-save card (`border-red-200 bg-red-50` pattern already in `InvoicesForm`).
- Map server codes to i18n messages (ML locked, credit ref missing, förenklad gate, currency, VAT refused).
- Chip validation dots on Information / Lines tabs when hidden-tab errors exist (Contacts/Estimates pattern).

---

## 3. Återanvändning

| Pattern / component                         | Use                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Estimates: Edit disabled when `invoiced`    | Issued invoice Edit/Delete disabled                                                                              |
| `ConfirmDialog` warning / danger            | Issue lock confirm; delete; credit note                                                                          |
| `DetailHeaderMenus` + action variants       | No new header chrome                                                                                             |
| Ghost fact fields + `?tab=` shell           | Form/view parity (`PLUGIN_VIEW_IMPLEMENTATION_GUIDE`)                                                            |
| `InvoicePricingSummary` extension           | Per-rate VAT rows                                                                                                |
| `InvoiceLineItemsEditor`                    | VAT as select, not free number                                                                                   |
| `StatusOutlineBadge` / existing type labels | Document profile as text/badge chip style                                                                        |
| `TransientActionHint` (optional)            | Explain disabled Edit (Schedule lock pattern) — optional; tooltip on disabled button acceptable if hint is heavy |
| Facio PDF/web layout                        | Add credit imprint + VAT breakdown; do not redesign document                                                     |

**New patterns:** None required. No new dialog family, no new sidebar order, no card-in-hero.

---

## 4. Tillgänglighet och responsivitet

- Disabled Edit/Delete: still focusable where platform allows; accessible name includes reason, or paired live region / hint on activate.
- Issue confirm: keyboard Esc cancels; primary action not destructive-red (warning variant).
- Date fields and selects: visible labels (existing DETAILED_FIELD label pattern); errors via `FORM_INPUT_ERROR_CLASS` + list.
- Per-rate VAT: text + `tabular-nums`, not color-only meaning.
- Mobile: same `?tab=` stack as today; supply date stacks under issue date in `sm:grid-cols-2`.
- Contrast: keep existing status/badge tokens; no new purple/glow.

---

## 5. Teknisk genomförbarhet (vs Architect)

Aligned with Grind 2:

- Client mirrors only; server is authority (409/400 codes).
- `creditedInvoiceId` + `correctionSummary` + `supplyDate` + `contentProfile` + `vatBreakdown` as designed.
- No UI for ändringsfaktura, RC legends, foreign currency, or snapshot browser.
- Issue pipeline triggered by leave-draft / Send → `sent` (and any other non-draft transition from draft).

**Open (non-blocking for UX):** Exact status control for `canceled` on view — keep current view affordance if present; Frontend must not invent a second edit surface.

---

## 6. Angränsande förbättringar (out of scope)

- Stale `docs/INVOICES_PLUGIN.md` list UX (cards/QC) — Docs specialist in program.
- Credit-note “remaining” payment UX for negative totals (already known limitation).
- Recurring / estimate→invoice / email / Peppol — out of program.

---

## 7. i18n keys (indicative)

Add en + sv for: issue confirm title/body/confirm; issued locked hint; supply date label/help; document profile full/simplified; credits invoice; correction summary label/placeholder; credit confirm body update; VAT per-rate row; currency SEK-only; förenklad over-limit; VAT posture refused; ML locked.

---

## Frontend implementation pointers

- Follow view/edit sync and discard-guard rules in `PLUGIN_VIEW_IMPLEMENTATION_GUIDE.md`.
- Prefer Estimates header gating over greyed full-form edit.
- Do not claim ML compliance in UI copy; avoid “Skatteverket-godkänd” language.
