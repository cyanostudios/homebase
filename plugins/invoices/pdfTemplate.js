// plugins/invoices/pdfTemplate.js
// Swedish Facio-style invoice PDF (issuer from Settings → Account organization).

const { escapeHtml, escapeHtmlText } = require('../../server/core/utils/htmlEscape');
const { resolveInvoiceTotals } = require('./invoiceTotals');

function escapeAttr(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('sv-SE');
}

/** Swedish document title from invoice type (header + browser title). */
function formatInvoiceDocumentTitle(invoiceType) {
  switch (String(invoiceType || 'invoice').trim()) {
    case 'credit_note':
      return 'Kreditfaktura';
    case 'cash_invoice':
      return 'Kontantfaktura';
    case 'receipt':
      return 'Kvitto';
    case 'invoice':
    default:
      return 'Faktura';
  }
}

/** Swedish number: 64 900,00 (no currency symbol). */
function formatSvNumber(amount, { minFrac = 2, maxFrac = 2 } = {}) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  }).format(n);
}

function formatCurrency(amount, currency = 'SEK') {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  try {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/** Contact-style day count ("30") or free text → Swedish label for the document. */
function formatPaymentTermsSv(paymentTerms) {
  const raw = paymentTerms == null ? '' : String(paymentTerms).trim();
  if (!raw) {
    return '30 dagar';
  }
  if (/^\d+$/.test(raw)) {
    const days = parseInt(raw, 10);
    return days === 0 ? 'Omedelbart' : `${days} dagar`;
  }
  const match = raw.match(/(\d+)/);
  if (match && !/dagar|days/i.test(raw)) {
    return `${match[1]} dagar`;
  }
  return raw;
}

function resolveVatLabel(lineItems, _totalVat) {
  const priced = Array.isArray(lineItems) ? lineItems.filter((li) => li && li.kind !== 'text') : [];
  const rates = [
    ...new Set(priced.map((li) => Number(li.vatRate ?? 25)).filter((r) => Number.isFinite(r))),
  ];
  if (rates.length === 1) {
    return `Moms (${rates[0]}%)`;
  }
  if (rates.length > 1) {
    return `Moms (${rates.map((r) => `${r}%`).join(', ')})`;
  }
  return 'Moms (25%)';
}

function lineDescription(li) {
  const title = li.name || li.title || '';
  const desc = li.description || '';
  if (title && desc && title !== desc) {
    return `${title}\n${desc}`;
  }
  return title || desc || 'Tjänst / vara';
}

function lineSum(li) {
  if (typeof li.lineSubtotalAfterDiscount === 'number') {
    return li.lineSubtotalAfterDiscount;
  }
  if (typeof li.lineSubtotal === 'number') {
    return li.lineSubtotal;
  }
  return Number(li.quantity || 0) * Number(li.unitPrice || 0);
}

function formatDisc(li) {
  const d = Number(li.discount || 0);
  if (!Number.isFinite(d) || d <= 0) {
    return '—';
  }
  return `${formatSvNumber(d, { minFrac: 0, maxFrac: 2 })}%`;
}

function formatQty(li) {
  const q = Number(li.quantity || 0);
  const unit = String(li.unit || li.unitLabel || '').trim();
  const qtyStr = formatSvNumber(q, { minFrac: 0, maxFrac: 2 });
  return unit ? `${qtyStr} ${escapeHtml(unit)}` : qtyStr;
}

/**
 * Shared Facio document CSS (PDF + public web).
 * Light-blue hairlines, generous whitespace, bold payment summary.
 */
function facioDocumentStyles() {
  return `
      * { box-sizing: border-box; }
      body {
        font-family: Helvetica, Arial, 'Helvetica Neue', sans-serif;
        color: #111827;
        margin: 0;
        padding: 0;
        font-size: 12px;
        line-height: 1.45;
        background: #fff;
      }
      .page {
        max-width: 720px;
        margin: 0 auto;
        /* Top clearance for repeating page label is in Puppeteer margin. */
        padding: 2mm 10mm 6mm;
      }
      .doc-header {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        align-items: center;
        margin-bottom: 28px;
      }
      .doc-header .issuer-brand {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .doc-header .issuer-logo {
        display: block;
        max-height: 64px;
        max-width: 220px;
        width: auto;
        height: auto;
        object-fit: contain;
        margin: 0;
        flex-shrink: 0;
      }
      .doc-header .issuer-name {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #0f172a;
        line-height: 1.2;
      }
      .doc-header .title-block {
        display: block;
        min-width: 0;
      }
      .doc-header .title-row {
        display: block;
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        color: #0f172a;
        text-align: left;
        line-height: 1.2;
      }
      .doc-header .title-row .lbl {
        font-size: inherit;
        font-weight: inherit;
        color: inherit;
      }
      .doc-header .title-row .lbl::after { content: none; }
      .doc-header .title-row .val {
        font-size: inherit;
        font-weight: inherit;
        margin-left: 0.35em;
      }
      .top {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: auto auto;
        column-gap: 32px;
        row-gap: 16px;
        margin-bottom: 28px;
        align-items: start;
      }
      .top-customer { grid-column: 1; grid-row: 1; }
      .top-payment { grid-column: 2; grid-row: 1; }
      .top-left-meta { grid-column: 1; grid-row: 2; }
      .top-right-meta { grid-column: 2; grid-row: 2; }
      .issuer-lines {
        color: #334155;
        font-size: 12px;
      }
      .issuer-lines p { margin: 1px 0; }
      .summary {
        text-align: left;
        max-width: 220px;
      }
      .summary .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        margin-bottom: 6px;
      }
      .summary .row.customer-row {
        align-items: flex-start;
        justify-content: flex-start;
      }
      .summary .row.plain .val {
        font-weight: 400;
      }
      .summary .row.customer-row > .lbl {
        line-height: 1.35;
        padding-top: 0;
        width: 7.5em;
        flex-shrink: 0;
      }
      .summary .lbl {
        font-size: 12px;
        color: #64748b;
        flex-shrink: 0;
      }
      .summary .lbl::after { content: ':'; }
      .summary .val,
      .summary .amount {
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
        text-align: right;
        margin-left: auto;
      }
      .summary .val.details {
        text-align: left;
        margin-left: 0;
        font-weight: 400;
        line-height: 1.35;
      }
      .summary .val.details p {
        margin: 0;
        font-weight: 400;
        color: #334155;
        line-height: 1.35;
      }
      .summary .val.details p + p {
        margin-top: 1px;
      }
      .summary .val.details p:first-child {
        font-weight: 700;
        color: #0f172a;
      }
      .customer-wrap { margin-top: 22px; }
      .rule {
        border: 0;
        border-top: 1px solid #93c5fd;
        margin: 0;
      }
      .meta {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 40px;
        padding: 14px 0;
        font-size: 12px;
      }
      .meta .pair { display: flex; gap: 6px; flex-wrap: wrap; }
      .meta .k { color: #64748b; }
      .meta .k::after { content: ':'; }
      .meta .v { font-weight: 400; color: #0f172a; }
      .items {
        width: 100%;
        border-collapse: collapse;
        margin-top: 18px;
      }
      .items th {
        text-align: left;
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
        padding: 8px 6px 10px 0;
        border-bottom: 1px solid #93c5fd;
      }
      .items th.right, .items td.right { text-align: right; }
      .items td {
        padding: 12px 6px 12px 0;
        vertical-align: top;
        border-bottom: 1px solid #e2e8f0;
      }
      .items .desc {
        white-space: pre-wrap;
        font-weight: 500;
        color: #0f172a;
      }
      .items .num { white-space: nowrap; font-variant-numeric: tabular-nums; }
      .totals-wrap {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 32px;
        margin-top: 18px;
      }
      .notes-block {
        flex: 1;
        min-width: 0;
        max-width: 22rem;
        margin: 0;
        padding: 0;
        align-self: flex-start;
      }
      .notes-block table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      .notes-block td {
        padding: 4px 0;
        color: #334155;
        line-height: 1.45;
        vertical-align: top;
      }
      .notes-block tr:first-child td { padding-top: 0; }
      .notes-block .notes-body {
        white-space: pre-wrap;
        color: #0f172a;
      }
      .totals {
        width: 260px;
        border-collapse: collapse;
        font-size: 12px;
        margin: 0 0 0 auto;
        padding: 0;
        flex-shrink: 0;
        align-self: flex-start;
      }
      .totals td { padding: 4px 0; color: #334155; line-height: 1.45; vertical-align: top; }
      .totals tr:first-child td { padding-top: 0; }
      .totals .amount {
        text-align: right;
        font-variant-numeric: tabular-nums;
        padding-left: 24px;
      }
      .totals .grand td {
        padding-top: 10px;
        font-weight: 800;
        font-size: 14px;
        color: #0f172a;
      }
      .footer {
        margin-top: 36px;
        padding-top: 16px;
        border-top: 1px solid #93c5fd;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 16px 24px;
        font-size: 10px;
        font-weight: 400;
        color: #0f172a;
        line-height: 1.4;
      }
      .footer strong {
        color: #0f172a;
        font-weight: 400;
      }
      .footer .lab {
        font-weight: 400;
        color: #64748b;
        min-width: 4rem;
        display: inline-block;
      }
      .footer-company p { margin: 1px 0; color: #0f172a; }
      .footer-company p:first-child { margin-bottom: 2px; color: #0f172a; }
      .footer-company .footer-site {
        margin-top: 10px;
        color: #0f172a;
      }
      .footer-col > div { margin: 1px 0; color: #0f172a; }
      .expired-banner {
        background: #dc2626;
        color: #fff;
        text-align: center;
        padding: 8px;
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 16px;
        border-radius: 6px;
      }
      @media print {
        .page { padding: 0; max-width: none; }
        .expired-banner { display: none; }
      }
  `;
}

/**
 * @param {object} invoice
 * @param {object} [organization] - tenant OrganizationProfile from Settings → Account
 * @param {object} [customer] - optional { name, organizationNumber, line1, line2, postalCode, city, country }
 * @param {{ expired?: boolean, referencePerson?: string }} [options]
 */
function generatePDFHTML(invoice, organization = {}, customer = null, options = {}) {
  const org = organization || {};
  const address = org.address || {};
  const billing = org.billing || {};

  const safeTotals = resolveInvoiceTotals(invoice);

  const numberLabel = escapeHtml(invoice.invoiceNumber || `UTKAST-${invoice.id}`);
  const documentTitle = formatInvoiceDocumentTitle(invoice.invoiceType);
  const issuerName = escapeHtml(org.name || 'Företag');
  const logoUrl = typeof org.logoUrl === 'string' ? org.logoUrl.trim() : '';
  const logoSrc = logoUrl ? escapeAttr(logoUrl) : '';
  const issuerLine1 = escapeHtml(address.line1 || '');
  const issuerLine2 = escapeHtml(address.line2 || '');
  const issuerCity = escapeHtml([address.postalCode, address.city].filter(Boolean).join(' ') || '');
  const issuerCountry = escapeHtml(address.country || '');
  const issuerEmail = escapeHtml(org.email || billing.invoiceEmail || '');
  const issuerPhone = escapeHtml(org.phone || '');
  const issuerSite = escapeHtml(org.website || '');
  const orgNr = escapeHtml(billing.organizationNumber || '');
  const vatNr = escapeHtml(billing.vatNumber || '');
  const bankgiro = escapeHtml(billing.bankgiro || '');
  const plusgiro = escapeHtml(billing.plusgiro || '');
  const iban = escapeHtml(billing.iban || '');
  const bic = escapeHtml(billing.bic || '');
  const swish = escapeHtml(billing.swishNumber || '');
  const fTaxApproved = (billing.fTax || 'yes') !== 'no';
  const lateInterest = escapeHtml(String(billing.latePaymentInterest || '12'));
  const paymentTerms = escapeHtml(formatPaymentTermsSv(invoice.paymentTerms));
  const notesText = escapeHtmlText(String(invoice.notes || '').trim());

  const cust = customer || {};
  const customerName = escapeHtml(cust.name || invoice.contactName || 'Kund');
  const customerOrg = escapeHtml(cust.organizationNumber || invoice.organizationNumber || '');
  const customerLine1 = escapeHtml(cust.line1 || '');
  const customerLine2 = escapeHtml(cust.line2 || '');
  const customerCity = escapeHtml([cust.postalCode, cust.city].filter(Boolean).join(' ') || '');
  const customerCountry = escapeHtml(cust.country || '');
  const customerReference = escapeHtml(
    cust.reference || invoice.customerReference || invoice.customerRef || '',
  );
  const customerNumber = escapeHtml(
    String(cust.customerNumber || invoice.customerNumber || '').trim(),
  );
  const deliveryMethod = escapeHtml(
    String(cust.deliveryMethod || invoice.deliveryMethod || invoice.delivery || '').trim(),
  );
  const orderNumber = escapeHtml(
    String(invoice.orderNumber || invoice.order_number || cust.orderNumber || '').trim(),
  );
  const customerBlockHtml = `
        <div class="top-customer">
          <div class="summary">
            <div class="row customer-row">
              <span class="lbl">Kund</span>
              <div class="val details">
                <p>${customerName}</p>
                ${customerOrg ? `<p>Org.nr ${customerOrg}</p>` : ''}
                ${customerLine1 ? `<p>${customerLine1}</p>` : ''}
                ${customerLine2 ? `<p>${customerLine2}</p>` : ''}
                ${customerCity ? `<p>${customerCity}</p>` : ''}
                ${customerCountry ? `<p>${customerCountry}</p>` : ''}
              </div>
            </div>
          </div>
        </div>`;
  const leftMetaHtml = `
        <div class="top-left-meta">
          <div class="summary">
            <div class="row customer-row">
              <span class="lbl">Kundreferens</span>
              <span class="val details">${customerReference || '—'}</span>
            </div>
            <div class="row customer-row">
              <span class="lbl">Kundnummer</span>
              <span class="val details">${customerNumber || '—'}</span>
            </div>
            <div class="row customer-row">
              <span class="lbl">Ordernummer</span>
              <span class="val details">${orderNumber || '—'}</span>
            </div>
            <div class="row customer-row">
              <span class="lbl">Leveranssätt</span>
              <span class="val details">${deliveryMethod || '—'}</span>
            </div>
          </div>
        </div>`;

  const dueDate = formatDate(invoice.dueDate);
  const issueDate = formatDate(invoice.issueDate || invoice.createdAt);
  const vatLabel = resolveVatLabel(invoice.lineItems, safeTotals.totalVat);
  const amountDuePlain = `${formatSvNumber(safeTotals.total, { minFrac: 0, maxFrac: 2 })} kr`;
  const amountDueBold = formatSvNumber(safeTotals.total, { minFrac: 0, maxFrac: 2 });
  const expired = Boolean(options.expired);
  const invoiceDiscountPct = Number(invoice.invoiceDiscount || 0);
  const invoiceDiscountAmount = Number(safeTotals.invoiceDiscountAmount || 0);
  const subtotalAfterDiscount = Number(
    safeTotals.subtotalAfterDiscount ?? safeTotals.subtotal ?? 0,
  );
  const showInvoiceDiscount = invoiceDiscountAmount > 0.004;
  const invoiceDiscountRows = showInvoiceDiscount
    ? `
          <tr>
            <td>Summa</td>
            <td class="amount">${formatSvNumber(subtotalAfterDiscount)}</td>
          </tr>
          <tr>
            <td>Fakturarabatt ${formatSvNumber(invoiceDiscountPct, { minFrac: 0, maxFrac: 2 })}%</td>
            <td class="amount">−${formatSvNumber(invoiceDiscountAmount)}</td>
          </tr>`
    : '';

  return `
  <!DOCTYPE html>
  <html lang="sv">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${documentTitle} ${numberLabel}</title>
    <style>${facioDocumentStyles()}</style>
  </head>
  <body>
    <div class="page">
      ${expired ? '<div class="expired-banner">Denna delningslänk har gått ut.</div>' : ''}

      <header class="doc-header">
        <div class="issuer-brand">
          ${logoSrc ? `<img class="issuer-logo" src="${logoSrc}" alt="" />` : ''}
          <h1 class="issuer-name">${issuerName}</h1>
        </div>
        <div class="title-block">
          <div class="title-row">
            <span class="lbl">${documentTitle}</span>
            <span class="val">${numberLabel}</span>
          </div>
        </div>
      </header>

      <div class="top">
        ${customerBlockHtml}

        <div class="top-payment">
          <div class="summary">
            <div class="row">
              <span class="lbl">Förfallodatum</span>
              <span class="val">${dueDate || '—'}</span>
            </div>
            <div class="row">
              <span class="lbl">Summa att betala</span>
              <span class="amount">${amountDuePlain}</span>
            </div>
            <div class="row">
              <span class="lbl">Ange referens</span>
              <span class="val">${numberLabel}</span>
            </div>
            ${
              bankgiro
                ? `<div class="row">
              <span class="lbl">Bankgiro</span>
              <span class="val">${bankgiro}</span>
            </div>`
                : ''
            }
          </div>
        </div>
        ${leftMetaHtml}
        <div class="top-right-meta">
          <div class="summary">
            <div class="row plain">
              <span class="lbl">Fakturadatum</span>
              <span class="val">${issueDate || '—'}</span>
            </div>
            <div class="row plain">
              <span class="lbl">Betalningsvillkor</span>
              <span class="val">${paymentTerms}</span>
            </div>
            <div class="row plain">
              <span class="lbl">Dröjsmålsränta</span>
              <span class="val">${lateInterest}%</span>
            </div>
          </div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th style="width:40%;">Beskrivning</th>
            <th class="right" style="width:14%;">Antal</th>
            <th class="right" style="width:16%;">À-pris</th>
            <th class="right" style="width:14%;">Rabatt</th>
            <th class="right" style="width:16%;">Summa</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.lineItems || [])
            .map((li) => {
              if (li.kind === 'text') {
                return `
            <tr>
              <td class="desc" colspan="5">${escapeHtml(lineDescription(li))}</td>
            </tr>
          `;
              }
              return `
            <tr>
              <td class="desc">${escapeHtml(lineDescription(li))}</td>
              <td class="right num">${formatQty(li)}</td>
              <td class="right num">${formatSvNumber(li.unitPrice || 0)}</td>
              <td class="right num">${formatDisc(li)}</td>
              <td class="right num">${formatSvNumber(lineSum(li))}</td>
            </tr>
          `;
            })
            .join('')}
        </tbody>
      </table>

      <div class="totals-wrap">
        ${
          notesText
            ? `<div class="notes-block">
          <table>
            <tr><td>Anteckningar och villkor</td></tr>
            <tr><td class="notes-body">${notesText}</td></tr>
          </table>
        </div>`
            : '<div class="notes-block"></div>'
        }
        <table class="totals">
          ${invoiceDiscountRows}
          <tr>
            <td>Summa ex moms</td>
            <td class="amount">${formatSvNumber(
              safeTotals.subtotalAfterInvoiceDiscount ?? safeTotals.subtotal,
            )}</td>
          </tr>
          <tr>
            <td>${vatLabel}</td>
            <td class="amount">${formatSvNumber(safeTotals.totalVat)}</td>
          </tr>
          <tr class="grand">
            <td>Summa att betala</td>
            <td class="amount">${amountDueBold}</td>
          </tr>
        </table>
      </div>

      <div class="footer">
        <div class="footer-company">
          <p><strong>${issuerName}</strong></p>
          ${issuerLine1 ? `<p>${issuerLine1}</p>` : ''}
          ${issuerLine2 ? `<p>${issuerLine2}</p>` : ''}
          ${issuerCity ? `<p>${issuerCity}</p>` : ''}
          ${issuerCountry ? `<p>${issuerCountry}</p>` : ''}
          ${fTaxApproved ? '<p>Godkänd för F-skatt</p>' : ''}
          ${issuerSite ? `<p class="footer-site">${issuerSite}</p>` : ''}
        </div>
        <div class="footer-col">
          ${orgNr ? `<div><span class="lab">Org.nr</span> ${orgNr}</div>` : ''}
          ${vatNr ? `<div><span class="lab">VAT-nr</span> ${vatNr}</div>` : ''}
          ${issuerPhone ? `<div><span class="lab">Tel</span> ${issuerPhone}</div>` : ''}
          ${issuerEmail ? `<div><span class="lab">Mail</span> ${issuerEmail}</div>` : ''}
        </div>
        <div class="footer-col">
          ${bankgiro ? `<div><span class="lab">Bankgiro</span> ${bankgiro}</div>` : ''}
          ${plusgiro ? `<div><span class="lab">Plusgiro</span> ${plusgiro}</div>` : ''}
          ${iban ? `<div><span class="lab">IBAN</span> ${iban}</div>` : ''}
          ${bic ? `<div><span class="lab">BIC</span> ${bic}</div>` : ''}
          ${swish ? `<div><span class="lab">Swish</span> ${swish}</div>` : ''}
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

module.exports = {
  generatePDFHTML,
  formatDate,
  formatCurrency,
  formatSvNumber,
  facioDocumentStyles,
};
