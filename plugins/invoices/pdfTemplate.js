// plugins/invoices/pdfTemplate.js
// Swedish Facio-style invoice PDF (issuer from Settings → Account organization).

const { escapeHtml } = require('../../server/core/utils/htmlEscape');

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('sv-SE');
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

function formatAmountPlain(amount) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
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

/**
 * @param {object} invoice
 * @param {object} [organization] - tenant OrganizationProfile from Settings → Account
 */
function generatePDFHTML(invoice, organization = {}) {
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
  const issuerLine1 = escapeHtml(address.line1 || '');
  const issuerLine2 = escapeHtml(address.line2 || '');
  const issuerCity = escapeHtml([address.postalCode, address.city].filter(Boolean).join(' ') || '');
  const issuerEmail = escapeHtml(org.email || billing.invoiceEmail || '');
  const orgNr = escapeHtml(billing.organizationNumber || '');
  const vatNr = escapeHtml(billing.vatNumber || '');
  const bankgiro = escapeHtml(billing.bankgiro || '');
  const fTaxApproved = (billing.fTax || 'yes') !== 'no';
  const lateInterest = escapeHtml(String(billing.latePaymentInterest || '12'));
  const paymentTerms = escapeHtml(formatPaymentTermsSv(invoice.paymentTerms));
  const customerName = escapeHtml(invoice.contactName || 'Kund');
  const customerOrg = escapeHtml(invoice.organizationNumber || '');
  const currency = invoice.currency || 'SEK';
  const dueDate = formatDate(invoice.dueDate);
  const issueDate = formatDate(invoice.issueDate || invoice.createdAt);
  const vatLabel = resolveVatLabel(invoice.lineItems, safeTotals.totalVat);
  const amountDue = formatCurrency(safeTotals.total, currency);
  const amountDuePlain = `${formatAmountPlain(safeTotals.total)} kr`;

  return `
  <!DOCTYPE html>
  <html lang="sv">
  <head>
    <meta charset="utf-8">
    <title>Faktura ${numberLabel}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        color: #111827;
        margin: 0;
        padding: 0;
        font-size: 11px;
        line-height: 1.4;
      }
      .page { max-width: 720px; margin: 0 auto; padding: 8mm 4mm; }
      .top-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        margin-bottom: 20px;
      }
      .issuer h1 { margin: 0 0 6px 0; font-size: 18px; font-weight: 700; }
      .issuer p, .customer p { margin: 2px 0; color: #374151; }
      .summary-box { text-align: right; }
      .summary-box .label { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
      .summary-box .value { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
      .summary-box .amount-big { font-size: 22px; font-weight: 800; margin: 4px 0 12px 0; }
      .meta-table { width: 100%; border-collapse: collapse; margin: 16px 0 20px 0; }
      .meta-table td { padding: 6px 8px 6px 0; vertical-align: top; }
      .meta-table .k { color: #6b7280; width: 28%; font-size: 10px; text-transform: uppercase; }
      .meta-table .v { font-weight: 600; }
      .items { width: 100%; border-collapse: collapse; margin-top: 8px; }
      .items th {
        text-align: left;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #6b7280;
        border-bottom: 2px solid #111827;
        padding: 8px 6px;
      }
      .items td { padding: 10px 6px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      .items .right { text-align: right; white-space: nowrap; }
      .items .desc { white-space: pre-wrap; font-weight: 500; }
      .totals { margin-top: 16px; display: flex; justify-content: flex-end; }
      .totals table { width: 280px; border-collapse: collapse; }
      .totals td { padding: 4px 0; }
      .totals .amount { text-align: right; font-variant-numeric: tabular-nums; }
      .totals .grand td { border-top: 2px solid #111827; padding-top: 8px; font-weight: 700; font-size: 13px; }
      .footer-block {
        margin-top: 28px;
        padding-top: 16px;
        border-top: 1px solid #e5e7eb;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        font-size: 10px;
        color: #4b5563;
      }
      .footer-block strong { color: #111827; }
      .pay-box {
        margin-top: 20px;
        padding: 14px 16px;
        background: #f8fafc;
        border-radius: 6px;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 12px;
      }
      .pay-box .k { font-size: 9px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.04em; }
      .pay-box .v { font-weight: 700; font-size: 13px; margin-top: 2px; }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="top-grid">
        <div class="issuer">
          <h1>${issuerName}</h1>
          ${issuerLine1 ? `<p>${issuerLine1}</p>` : ''}
          ${issuerLine2 ? `<p>${issuerLine2}</p>` : ''}
          ${issuerCity ? `<p>${issuerCity}</p>` : ''}
          ${orgNr ? `<p>Org-nr ${orgNr}</p>` : ''}
          ${issuerEmail ? `<p>${issuerEmail}</p>` : ''}
          ${bankgiro ? `<p>Bankgiro ${bankgiro}</p>` : ''}
        </div>
        <div class="summary-box">
          <div class="label">Faktura</div>
          <div class="value">${numberLabel}</div>
          <div class="label">Förfallodatum</div>
          <div class="value">${dueDate || '—'}</div>
          <div class="label">Summa att betala</div>
          <div class="amount-big">${amountDuePlain}</div>
          <div class="label">Ange referens</div>
          <div class="value">${numberLabel}</div>
        </div>
      </div>

      <div class="top-grid">
        <div class="customer">
          <p style="color:#6b7280;font-size:10px;text-transform:uppercase;margin-bottom:4px;">Kund</p>
          <p><strong>${customerName}</strong></p>
          ${customerOrg ? `<p>Org-nr ${customerOrg}</p>` : ''}
        </div>
        <div></div>
      </div>

      <table class="meta-table">
        <tr>
          <td class="k">Fakturanummer</td>
          <td class="v">${numberLabel}</td>
          <td class="k">Fakturadatum</td>
          <td class="v">${issueDate || '—'}</td>
        </tr>
        <tr>
          <td class="k">Kund</td>
          <td class="v">${customerName}</td>
          <td class="k">Betalningsvillkor</td>
          <td class="v">${paymentTerms}</td>
        </tr>
        <tr>
          <td class="k">Referens</td>
          <td class="v">${numberLabel}</td>
          <td class="k">Dröjsmålsränta</td>
          <td class="v">${lateInterest}%</td>
        </tr>
      </table>

      <table class="items">
        <thead>
          <tr>
            <th style="width:48%;">Beskrivning</th>
            <th style="width:14%;" class="right">Antal</th>
            <th style="width:19%;" class="right">À-pris</th>
            <th style="width:19%;" class="right">Summa</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.lineItems || [])
            .map(
              (li) => `
            <tr>
              <td class="desc">${escapeHtml(lineDescription(li))}</td>
              <td class="right">${li.quantity || 0}</td>
              <td class="right">${formatCurrency(li.unitPrice || 0, currency)}</td>
              <td class="right">${formatCurrency(lineSum(li), currency)}</td>
            </tr>
          `,
            )
            .join('')}
        </tbody>
      </table>

      <div class="totals">
        <table>
          <tr>
            <td>Summa ex moms</td>
            <td class="amount">${formatCurrency(
              safeTotals.subtotalAfterInvoiceDiscount ?? safeTotals.subtotal,
              currency,
            )}</td>
          </tr>
          <tr>
            <td>${vatLabel}</td>
            <td class="amount">${formatCurrency(safeTotals.totalVat, currency)}</td>
          </tr>
          <tr class="grand">
            <td>Summa att betala</td>
            <td class="amount">${amountDue}</td>
          </tr>
        </table>
      </div>

      <div class="pay-box">
        <div>
          <div class="k">Förfallodatum</div>
          <div class="v">${dueDate || '—'}</div>
        </div>
        <div>
          <div class="k">Referens</div>
          <div class="v">${numberLabel}</div>
        </div>
        <div>
          <div class="k">Bankgiro</div>
          <div class="v">${bankgiro || '—'}</div>
        </div>
      </div>

      <div class="footer-block">
        <div>
          <strong>${issuerName}</strong><br/>
          ${issuerLine1 ? `${issuerLine1}<br/>` : ''}
          ${issuerCity ? `${issuerCity}<br/>` : ''}
          ${issuerEmail || ''}
        </div>
        <div>
          ${orgNr ? `<div><strong>Org-nr</strong> ${orgNr}</div>` : ''}
          ${vatNr ? `<div><strong>VAT-nr</strong> ${vatNr}</div>` : ''}
          ${bankgiro ? `<div><strong>Bankgiro</strong> ${bankgiro}</div>` : ''}
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
  fallbackTotals,
};
