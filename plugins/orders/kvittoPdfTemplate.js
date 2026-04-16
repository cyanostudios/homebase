// plugins/orders/kvittoPdfTemplate.js
// PDF template: one full-page receipt per order (A4 print).

const {
  formatAddress,
  formatCurrency,
  getCustomerPhone,
  getCustomerEmail,
  formatChannelLabel,
  escapeHtml,
  formatPlacedAt,
  aggregateVatInklMoms,
} = require('./ordersPdfCommon');

/**
 * Kund vänster, leverans höger. Om bara en adress finns: samma i båda kolumnerna.
 */
function customerAndDeliveryColumns(order) {
  const billLines = formatAddress(order.billingAddress);
  const shipLines = formatAddress(order.shippingAddress);

  if (billLines.length === 0 && shipLines.length > 0) {
    return { kundLines: shipLines, levLines: shipLines };
  }
  if (shipLines.length === 0 && billLines.length > 0) {
    return { kundLines: billLines, levLines: billLines };
  }
  return { kundLines: billLines, levLines: shipLines };
}

function linesToHtml(lines) {
  if (!lines.length) {
    return '<div>—</div>';
  }
  return lines.map((line) => `<div>${escapeHtml(line)}</div>`).join('');
}

/**
 * @param {Array<{ order: object, ordersumma: number, frakt: number|null }>} orders
 * @returns {string} HTML string
 */
function generateKvittoHTML(orders) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kvitto</title></head>
<body><p>Inga order att visa.</p></body></html>`;
  }

  const pages = orders.map(({ order, ordersumma, frakt }, index) => {
    const phone = getCustomerPhone(order.customer);
    const email = getCustomerEmail(order.customer);
    const platformLabel =
      order.platformLabel != null
        ? String(order.platformLabel)
        : formatChannelLabel(order.channel, order.channelLabel);
    const butiksOrdernummer = order.platformOrderNumber || order.channelOrderId || '—';
    const currency = order.currency || 'SEK';
    const totalAmount = order.totalAmount != null ? Number(order.totalAmount) : null;
    const fraktDisplay =
      frakt != null && Number.isFinite(frakt) ? formatCurrency(frakt, currency) : '—';
    const totalDisplay =
      totalAmount != null && Number.isFinite(totalAmount)
        ? formatCurrency(totalAmount, currency)
        : '—';
    const ordersummaDisplay =
      ordersumma != null && Number.isFinite(ordersumma)
        ? formatCurrency(ordersumma, currency)
        : '—';

    const placed = formatPlacedAt(order.placedAt);

    const { kundLines, levLines } = customerAndDeliveryColumns(order);

    const items = Array.isArray(order.items) ? order.items : [];
    const { vatByRate, netTotal } = aggregateVatInklMoms(items, frakt);
    const vatRateKeys = Object.keys(vatByRate)
      .map(Number)
      .sort((a, b) => a - b);
    const vatRowsHtml = vatRateKeys
      .filter((rate) => (vatByRate[rate] || 0) > 0.0001)
      .map((rate) => {
        const amt = vatByRate[rate];
        const label =
          Number.isInteger(rate) || Math.abs(rate - Math.round(rate)) < 1e-6
            ? String(Math.round(rate))
            : String(rate);
        return `<div class="sum-line sum-vat"><span class="lbl">Varav moms (${label} %):</span> ${formatCurrency(amt, currency)}</div>`;
      })
      .join('');
    const netTotalDisplay = Number.isFinite(netTotal) ? formatCurrency(netTotal, currency) : '—';

    const rows = items
      .map((it) => {
        const qty = Number(it.quantity);
        const unit = it.unitPrice != null ? Number(it.unitPrice) : 0;
        const line = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : null;
        const lineDisplay =
          line != null && Number.isFinite(line) ? formatCurrency(line, currency) : '—';
        const unitDisplay = Number.isFinite(unit) ? formatCurrency(unit, currency) : '—';
        return `
        <tr>
          <td class="col-desc">${escapeHtml(it.title || '—')}</td>
          <td class="col-sku">${escapeHtml(it.sku != null && it.sku !== '' ? String(it.sku) : '—')}</td>
          <td class="col-num">${escapeHtml(String(it.quantity ?? '—'))}</td>
          <td class="col-num">${unitDisplay}</td>
          <td class="col-num">${lineDisplay}</td>
        </tr>`;
      })
      .join('');

    const isLast = index === orders.length - 1;
    const pageClass = `kvitto-page${isLast ? ' kvitto-page--last' : ''}`;

    return `
    <div class="${pageClass}">
      <div class="kvitto-page-inner">
      <header class="kvitto-header">
        <h1 class="kvitto-title">Kvitto</h1>
        <p class="kvitto-sub">Order ${escapeHtml(butiksOrdernummer)}</p>
      </header>

      <section class="kvitto-address-row">
        <div class="kvitto-col kvitto-col--addr">
          <h2 class="kvitto-h2">Kund</h2>
          <div class="kvitto-lines">
            ${linesToHtml(kundLines)}
            <div><span class="lbl">Telefon:</span> ${escapeHtml(phone || '—')}</div>
            <div><span class="lbl">E-post:</span> ${escapeHtml(email || '—')}</div>
          </div>
        </div>
        <div class="kvitto-col kvitto-col--addr">
          <h2 class="kvitto-h2">Leverans</h2>
          <div class="kvitto-lines">
            ${linesToHtml(levLines)}
          </div>
        </div>
      </section>

      <section class="kvitto-order-meta">
        <h2 class="kvitto-h2">Orderuppgifter</h2>
        <div class="kvitto-lines">
          <div><span class="lbl">Butik:</span> ${escapeHtml(platformLabel)}</div>
          <div><span class="lbl">Ordernummer:</span> ${escapeHtml(butiksOrdernummer)}</div>
          <div><span class="lbl">Beställt:</span> ${escapeHtml(placed)}</div>
          <div><span class="lbl">Valuta:</span> ${escapeHtml(currency)}</div>
        </div>
      </section>

      <table class="kvitto-table">
        <thead>
          <tr>
            <th class="col-desc">Artikel</th>
            <th class="col-sku">SKU</th>
            <th class="col-num">Antal</th>
            <th class="col-num">Á pris</th>
            <th class="col-num">Summa</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="5" class="col-desc">Inga orderrader</td></tr>'}
        </tbody>
      </table>

      <div class="kvitto-bottom">
        <div class="kvitto-sums">
          <div class="sum-line"><span class="lbl">Ordersumma:</span> ${ordersummaDisplay}</div>
          <div class="sum-line"><span class="lbl">Frakt:</span> ${fraktDisplay}</div>
          <hr class="kvitto-sum-rule" />
          <div class="sum-line"><span class="lbl">Summa exkl. moms:</span> ${netTotalDisplay}</div>
          ${vatRowsHtml}
          <div class="sum-line sum-total"><span class="lbl">Totalt (inkl. moms):</span> ${totalDisplay}</div>
        </div>
        <div class="kvitto-company-footer-slot" aria-hidden="true"></div>
      </div>
      </div>
    </div>`;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Kvitto</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4; margin: 14mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      margin: 0;
      padding: 0;
      font-size: 13px;
    }
    .kvitto-page {
      page-break-after: always;
      page-break-inside: avoid;
      padding: 4mm 0 12mm 0;
    }
    .kvitto-page--last {
      page-break-after: auto;
    }
    .kvitto-page-inner {
      display: flex;
      flex-direction: column;
      min-height: 252mm;
    }
    .kvitto-header {
      text-align: left;
      margin-bottom: 18px;
      border-bottom: 2px solid #111827;
      padding-bottom: 12px;
    }
    .kvitto-title { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.02em; }
    .kvitto-sub { margin: 8px 0 0 0; font-size: 14px; color: #4b5563; }
    .kvitto-address-row {
      display: flex;
      flex-wrap: wrap;
      gap: 20px 32px;
      justify-content: space-between;
      margin-bottom: 18px;
    }
    .kvitto-col--addr { flex: 1; min-width: 200px; max-width: 48%; }
    .kvitto-order-meta {
      margin-bottom: 16px;
    }
    .kvitto-h2 { margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; }
    .kvitto-lines { line-height: 1.45; }
    .lbl { font-weight: 600; color: #374151; margin-right: 6px; }
    .kvitto-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 12px;
      flex-shrink: 0;
    }
    .kvitto-table th,
    .kvitto-table td {
      padding: 8px 6px;
      text-align: left;
      border-bottom: 1px solid #e5e7eb;
    }
    .kvitto-table th {
      font-weight: 600;
      background: #f9fafb;
      border-bottom: 1px solid #d1d5db;
    }
    .col-num { text-align: right; white-space: nowrap; width: 14%; }
    .col-sku { width: 18%; }
    .col-desc { width: 40%; }
    .kvitto-bottom {
      margin-top: auto;
      padding-top: 20px;
      flex-shrink: 0;
    }
    .kvitto-sums {
      max-width: 320px;
      margin-left: auto;
      text-align: right;
      font-size: 14px;
    }
    .sum-line { margin-bottom: 6px; }
    .kvitto-sum-rule {
      border: 0;
      border-top: 1px solid #e5e7eb;
      margin: 10px 0;
    }
    .sum-line.sum-vat { font-size: 13px; color: #374151; }
    .sum-total { font-weight: 700; font-size: 16px; margin-top: 12px; padding-top: 12px; border-top: 2px solid #111827; }
    .kvitto-company-footer-slot {
      min-height: 40px;
      margin-top: 16px;
    }
  </style>
</head>
<body>
  ${pages.join('')}
</body>
</html>`;
}

module.exports = { generateKvittoHTML };
