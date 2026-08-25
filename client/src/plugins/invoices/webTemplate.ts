// client/src/plugins/invoices/webTemplate.ts
// Swedish Facio-style public invoice HTML (matches server pdfTemplate.js layout).

function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) {
    return '';
  }
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date: string | Date | null | undefined) {
  if (!date) {
    return '';
  }
  return new Date(date).toLocaleDateString('sv-SE');
}

function formatCurrency(amount: number, currency = 'SEK') {
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

function formatAmountPlain(amount: number) {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Contact-style day count ("30") or free text → Swedish label for the document. */
function formatPaymentTermsSv(paymentTerms: string | null | undefined): string {
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

function lineDescription(li: any): string {
  const title = li.name || li.title || '';
  const desc = li.description || '';
  if (title && desc && title !== desc) {
    return `${title}\n${desc}`;
  }
  return title || desc || 'Tjänst / vara';
}

function lineSum(li: any): number {
  if (typeof li.lineSubtotalAfterDiscount === 'number') {
    return li.lineSubtotalAfterDiscount;
  }
  if (typeof li.lineSubtotal === 'number') {
    return li.lineSubtotal;
  }
  return Number(li.quantity || 0) * Number(li.unitPrice || 0);
}

function resolveVatLabel(lineItems: any[], totalVat: number) {
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

export function generateInvoiceWebHTML(invoice: any): string {
  const org = invoice.organization || {};
  const address = org.address || {};
  const billing = org.billing || {};

  const totals = {
    subtotal: invoice.subtotal || 0,
    totalVat: invoice.totalVat || 0,
    total: invoice.total || 0,
    subtotalAfterInvoiceDiscount:
      (invoice.subtotalAfterInvoiceDiscount ?? invoice.subtotalAfterDiscount ?? invoice.subtotal) ||
      0,
  };

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
  const vatLabel = resolveVatLabel(invoice.lineItems || [], totals.totalVat);
  const amountDuePlain = `${formatAmountPlain(totals.total)} kr`;
  const isExpired =
    invoice.shareValidUntil && new Date(invoice.shareValidUntil).getTime() < Date.now();

  return `
    <!DOCTYPE html>
    <html lang="sv">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Faktura ${numberLabel}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .print-shadow { box-shadow: 0 0 40px rgba(0,0,0,0.05); }
        @media print {
          .no-print { display: none; }
          body { background: white; }
          .print-shadow { box-shadow: none; }
        }
      </style>
    </head>
    <body class="bg-gray-100 min-h-screen py-8 px-4">
      <div class="max-w-3xl mx-auto">
        ${
          isExpired
            ? `<div class="bg-red-600 text-white text-center py-2 text-sm font-medium no-print mb-4 rounded-lg">Denna delningslänk har gått ut.</div>`
            : ''
        }
        <div class="bg-white rounded-lg print-shadow overflow-hidden p-8 md:p-12">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div>
              <h1 class="text-2xl font-bold text-gray-900 mb-2">${issuerName}</h1>
              <div class="text-sm text-gray-600 space-y-0.5">
                ${issuerLine1 ? `<p>${issuerLine1}</p>` : ''}
                ${issuerLine2 ? `<p>${issuerLine2}</p>` : ''}
                ${issuerCity ? `<p>${issuerCity}</p>` : ''}
                ${orgNr ? `<p>Org-nr ${orgNr}</p>` : ''}
                ${issuerEmail ? `<p>${issuerEmail}</p>` : ''}
                ${bankgiro ? `<p>Bankgiro ${bankgiro}</p>` : ''}
              </div>
            </div>
            <div class="md:text-right space-y-3">
              <div>
                <div class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Faktura</div>
                <div class="text-lg font-bold text-gray-900">${numberLabel}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Förfallodatum</div>
                <div class="text-base font-bold text-gray-900">${dueDate || '—'}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Summa att betala</div>
                <div class="text-2xl font-extrabold text-gray-900">${amountDuePlain}</div>
              </div>
              <div>
                <div class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Ange referens</div>
                <div class="text-base font-bold text-gray-900">${numberLabel}</div>
              </div>
            </div>
          </div>

          <div class="mb-8">
            <div class="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-1">Kund</div>
            <div class="font-bold text-gray-900 text-lg">${customerName}</div>
            ${customerOrg ? `<div class="text-sm text-gray-500">Org-nr ${customerOrg}</div>` : ''}
          </div>

          <div class="grid grid-cols-2 gap-x-6 gap-y-3 text-sm mb-8 border-y border-gray-100 py-4">
            <div><span class="text-gray-400 text-xs uppercase">Fakturanummer</span><div class="font-semibold">${numberLabel}</div></div>
            <div><span class="text-gray-400 text-xs uppercase">Fakturadatum</span><div class="font-semibold">${issueDate || '—'}</div></div>
            <div><span class="text-gray-400 text-xs uppercase">Kund</span><div class="font-semibold">${customerName}</div></div>
            <div><span class="text-gray-400 text-xs uppercase">Betalningsvillkor</span><div class="font-semibold">${paymentTerms}</div></div>
            <div><span class="text-gray-400 text-xs uppercase">Referens</span><div class="font-semibold">${numberLabel}</div></div>
            <div><span class="text-gray-400 text-xs uppercase">Dröjsmålsränta</span><div class="font-semibold">${lateInterest}%</div></div>
          </div>

          <table class="w-full text-left mb-6">
            <thead>
              <tr class="border-b-2 border-gray-900">
                <th class="py-3 text-xs font-bold uppercase tracking-wider text-gray-500">Beskrivning</th>
                <th class="py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-20">Antal</th>
                <th class="py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-28">À-pris</th>
                <th class="py-3 text-right text-xs font-bold uppercase tracking-wider text-gray-500 w-28">Summa</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              ${(invoice.lineItems || [])
                .map(
                  (li: any) => `
              <tr>
                <td class="py-4 align-top whitespace-pre-wrap font-medium text-gray-900">${escapeHtml(lineDescription(li))}</td>
                <td class="py-4 text-right align-top tabular-nums">${li.quantity || 0}</td>
                <td class="py-4 text-right align-top tabular-nums">${formatCurrency(li.unitPrice || 0, currency)}</td>
                <td class="py-4 text-right align-top font-semibold tabular-nums">${formatCurrency(lineSum(li), currency)}</td>
              </tr>`,
                )
                .join('')}
            </tbody>
          </table>

          <div class="flex justify-end mb-8">
            <div class="w-full max-w-xs space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500">Summa ex moms</span>
                <span class="tabular-nums font-medium">${formatCurrency(totals.subtotalAfterInvoiceDiscount, currency)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">${vatLabel}</span>
                <span class="tabular-nums font-medium">${formatCurrency(totals.totalVat, currency)}</span>
              </div>
              <div class="flex justify-between items-baseline pt-3 border-t-2 border-gray-900">
                <span class="font-bold">Summa att betala</span>
                <span class="text-xl font-bold tabular-nums">${formatCurrency(totals.total, currency)}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4 bg-gray-50 rounded-lg p-4 mb-8 text-sm">
            <div>
              <div class="text-[10px] uppercase text-gray-400 font-semibold">Förfallodatum</div>
              <div class="font-bold mt-0.5">${dueDate || '—'}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase text-gray-400 font-semibold">Referens</div>
              <div class="font-bold mt-0.5">${numberLabel}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase text-gray-400 font-semibold">Bankgiro</div>
              <div class="font-bold mt-0.5">${bankgiro || '—'}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100 text-xs text-gray-600">
            <div>
              <div class="font-bold text-gray-900 mb-1">${issuerName}</div>
              ${issuerLine1 ? `<div>${issuerLine1}</div>` : ''}
              ${issuerCity ? `<div>${issuerCity}</div>` : ''}
              ${issuerEmail ? `<div class="mt-1">${issuerEmail}</div>` : ''}
            </div>
            <div class="space-y-0.5">
              ${orgNr ? `<div><span class="font-semibold text-gray-900">Org-nr</span> ${orgNr}</div>` : ''}
              ${vatNr ? `<div><span class="font-semibold text-gray-900">VAT-nr</span> ${vatNr}</div>` : ''}
              ${bankgiro ? `<div><span class="font-semibold text-gray-900">Bankgiro</span> ${bankgiro}</div>` : ''}
              ${fTaxApproved ? '<div class="font-semibold text-gray-900">Godkänd för F-skatt</div>' : ''}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
