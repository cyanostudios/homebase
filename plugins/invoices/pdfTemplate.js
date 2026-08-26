// plugins/invoices/pdfTemplate.js
// Swedish Facio-style invoice PDF (issuer from Settings → Account organization).

const { escapeHtml } = require('../../server/core/utils/htmlEscape');

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('sv-SE');
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

function fallbackTotals(lineItems = [], invoiceDiscount = 0, vatRateDefault = 0.25) {
  const subtotal = lineItems.reduce(
    (sum, li) => sum + Number(li.quantity || 0) * Number(li.unitPrice || 0),
    0,
  );
  const invoiceDiscountAmount = subtotal * (Number(invoiceDiscount || 0) / 100);
  const afterDiscount = subtotal - invoiceDiscountAmount;
  const totalVat = afterDiscount * vatRateDefault;
  const total = afterDiscount + totalVat;
  return {
    subtotal,
    totalDiscount: 0,
    subtotalAfterDiscount: subtotal,
    invoiceDiscountAmount,
    subtotalAfterInvoiceDiscount: afterDiscount,
    totalVat,
    total,
  };
}

function resolveVatLabel(lineItems, totalVat) {
  if (!totalVat || !Array.isArray(lineItems) || lineItems.length === 0) {
    return 'Moms 25%';
  }
  const rates = [
    ...new Set(lineItems.map((li) => Number(li.vatRate ?? 25)).filter((r) => Number.isFinite(r))),
  ];
  if (rates.length === 1) {
    return `Moms ${rates[0]}%`;
  }
  return 'Moms';
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
        padding: 10mm 8mm;
      }
      .top {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        margin-bottom: 28px;
        align-items: start;
      }
      .issuer-name, .doc-title {
        margin: 0 0 10px 0;
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: #0f172a;
      }
      .issuer-logo {
        display: block;
        max-height: 56px;
        max-width: 180px;
        width: auto;
        height: auto;
        object-fit: contain;
        margin: 0 0 10px 0;
      }
      .issuer-lines, .customer-block {
        color: #334155;
        font-size: 12px;
      }
      .issuer-lines p, .customer-block p { margin: 1px 0; }
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
      .summary .lbl {
        font-size: 12px;
        color: #64748b;
        flex-shrink: 0;
      }
      .summary .lbl::after { content: ':'; }
      .summary .val {
        font-size: 14px;
        font-weight: 700;
        color: #0f172a;
        text-align: right;
        margin-left: auto;
      }
      .summary .amount {
        font-size: 18px;
        font-weight: 800;
        color: #0f172a;
        text-align: right;
        margin-left: auto;
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
      .meta .v { font-weight: 600; color: #0f172a; }
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
        justify-content: flex-end;
        margin-top: 18px;
      }
      .totals {
        width: 260px;
        border-collapse: collapse;
        font-size: 12px;
      }
      .totals td { padding: 4px 0; color: #334155; }
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
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        font-size: 11px;
        color: #475569;
      }
      .footer strong { color: #0f172a; font-weight: 700; }
      .footer .lab { font-weight: 700; color: #0f172a; min-width: 4.5rem; display: inline-block; }
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
 * @param {object} [customer] - optional { name, organizationNumber, line1, line2, postalCode, city }
 * @param {{ expired?: boolean, referencePerson?: string }} [options]
 */
function generatePDFHTML(invoice, organization = {}, customer = null, options = {}) {
  const org = organization || {};
  const address = org.address || {};
  const billing = org.billing || {};

  const totals = {
    subtotal: invoice.subtotal ?? undefined,
    totalDiscount: invoice.totalDiscount ?? undefined,
    subtotalAfterDiscount: invoice.subtotalAfterDiscount ?? undefined,
    invoiceDiscountAmount: invoice.invoiceDiscountAmount ?? undefined,
    subtotalAfterInvoiceDiscount: invoice.subtotalAfterInvoiceDiscount ?? undefined,
    totalVat: invoice.totalVat ?? undefined,
    total: invoice.total ?? undefined,
  };
  const needFallback = Object.values(totals).some((v) => typeof v !== 'number' || Number.isNaN(v));
  const safeTotals = needFallback
    ? fallbackTotals(invoice.lineItems, invoice.invoiceDiscount)
    : totals;

  const numberLabel = escapeHtml(invoice.invoiceNumber || `UTKAST-${invoice.id}`);
  const issuerName = escapeHtml(org.name || 'Företag');
  const logoUrl = typeof org.logoUrl === 'string' ? org.logoUrl.trim() : '';
  const logoSrc = logoUrl ? escapeHtml(logoUrl) : '';
  const issuerLine1 = escapeHtml(address.line1 || '');
  const issuerLine2 = escapeHtml(address.line2 || '');
  const issuerCity = escapeHtml([address.postalCode, address.city].filter(Boolean).join(' ') || '');
  const issuerEmail = escapeHtml(org.email || billing.invoiceEmail || '');
  const referencePerson = escapeHtml(options.referencePerson || invoice.referencePerson || '');
  const orgNr = escapeHtml(billing.organizationNumber || '');
  const vatNr = escapeHtml(billing.vatNumber || '');
  const bankgiro = escapeHtml(billing.bankgiro || '');
  const fTaxApproved = (billing.fTax || 'yes') !== 'no';
  const lateInterest = escapeHtml(String(billing.latePaymentInterest || '12'));
  const paymentTerms = escapeHtml(formatPaymentTermsSv(invoice.paymentTerms));

  const cust = customer || {};
  const customerName = escapeHtml(cust.name || invoice.contactName || 'Kund');
  const customerOrg = escapeHtml(cust.organizationNumber || invoice.organizationNumber || '');
  const customerLine1 = escapeHtml(cust.line1 || '');
  const customerLine2 = escapeHtml(cust.line2 || '');
  const customerCity = escapeHtml([cust.postalCode, cust.city].filter(Boolean).join(' ') || '');

  const dueDate = formatDate(invoice.dueDate);
  const issueDate = formatDate(invoice.issueDate || invoice.createdAt);
  const vatLabel = resolveVatLabel(invoice.lineItems, safeTotals.totalVat);
  const amountDuePlain = `${formatSvNumber(safeTotals.total, { minFrac: 0, maxFrac: 2 })} kr`;
  const amountDueBold = formatSvNumber(safeTotals.total, { minFrac: 0, maxFrac: 2 });
  const expired = Boolean(options.expired);

  return `
  <!DOCTYPE html>
  <html lang="sv">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Faktura ${numberLabel}</title>
    <style>${facioDocumentStyles()}</style>
  </head>
  <body>
    <div class="page">
      ${expired ? '<div class="expired-banner">Denna delningslänk har gått ut.</div>' : ''}

      <div class="top">
        <div class="issuer">
          ${logoSrc ? `<img class="issuer-logo" src="${logoSrc}" alt="" />` : ''}
          <h1 class="issuer-name">${issuerName}</h1>
          <div class="issuer-lines">
            ${issuerLine1 ? `<p>${issuerLine1}</p>` : ''}
            ${issuerLine2 ? `<p>${issuerLine2}</p>` : ''}
            ${issuerCity ? `<p>${issuerCity}</p>` : ''}
            ${orgNr ? `<p>${orgNr}</p>` : ''}
            ${referencePerson ? `<p>${referencePerson}</p>` : ''}
            ${issuerEmail ? `<p>${issuerEmail}</p>` : ''}
          </div>
        </div>

        <div>
          <h1 class="doc-title">Faktura</h1>
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

          <div class="customer-wrap customer-block">
            <p><strong>${customerName}</strong></p>
            ${customerLine1 ? `<p>${customerLine1}</p>` : ''}
            ${customerLine2 ? `<p>${customerLine2}</p>` : ''}
            ${customerCity ? `<p>${customerCity}</p>` : ''}
            ${customerOrg ? `<p>${customerOrg}</p>` : ''}
          </div>
        </div>
      </div>

      <hr class="rule" />
      <div class="meta">
        <div class="pair"><span class="k">Fakturanummer</span><span class="v">${numberLabel}</span></div>
        <div class="pair"><span class="k">Fakturadatum</span><span class="v">${issueDate || '—'}</span></div>
        <div class="pair"><span class="k">Kund</span><span class="v">${customerName}</span></div>
        <div class="pair"><span class="k">Betalningsvillkor</span><span class="v">${paymentTerms}</span></div>
        <div class="pair"><span class="k">Referens</span><span class="v">${referencePerson || '—'}</span></div>
        <div class="pair"><span class="k">Dröjsmålsränta</span><span class="v">${lateInterest}%</span></div>
      </div>
      <hr class="rule" />

      <table class="items">
        <thead>
          <tr>
            <th style="width:46%;">Beskrivning</th>
            <th class="right" style="width:18%;">Antal</th>
            <th class="right" style="width:18%;">À-pris</th>
            <th class="right" style="width:18%;">Summa</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.lineItems || [])
            .map(
              (li) => `
            <tr>
              <td class="desc">${escapeHtml(lineDescription(li))}</td>
              <td class="right num">${formatQty(li)}</td>
              <td class="right num">${formatSvNumber(li.unitPrice || 0)}</td>
              <td class="right num">${formatSvNumber(lineSum(li))}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals-wrap">
        <table class="totals">
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
        <div>
          <strong>${issuerName}</strong><br/>
          ${issuerLine1 ? `${issuerLine1}<br/>` : ''}
          ${issuerCity ? `${issuerCity}<br/>` : ''}
          ${referencePerson ? `${referencePerson}<br/>` : ''}
          ${issuerEmail || ''}
        </div>
        <div>
          ${orgNr ? `<div><span class="lab">Org-nr</span> ${orgNr}</div>` : ''}
          ${vatNr ? `<div><span class="lab">VAT-nr</span> ${vatNr}</div>` : ''}
          ${bankgiro ? `<div><span class="lab">Bankgiro</span> ${bankgiro}</div>` : ''}
          ${fTaxApproved ? '<div><strong>Godkänd för F-skatt</strong></div>' : ''}
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
  fallbackTotals,
  facioDocumentStyles,
};
