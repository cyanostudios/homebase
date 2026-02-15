// plugins/orders/plocklistaPdfTemplate.js
// PDF template for plocklista (pick list): compact horizontal sections per order, lines between orders.

function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return [];
  const parts = [];

  if (addr.full_name || addr.fullName) {
    parts.push(addr.full_name || addr.fullName);
  } else {
    const name = [addr.first_name, addr.last_name].filter(Boolean).join(' ').trim();
    if (name) parts.push(name);
    if (addr.company) parts.push(addr.company);
  }

  if (addr.street_address || addr.streetAddress) {
    parts.push(addr.street_address || addr.streetAddress);
  } else {
    if (addr.address_1) parts.push(addr.address_1);
    if (addr.address_2) parts.push(addr.address_2);
  }

  const cityState = [addr.city, addr.state].filter(Boolean).join(', ').trim();
  const postal = addr.postcode || addr.postal_code || addr.postalCode;
  const location = [postal, cityState].filter(Boolean).join(' ').trim();
  if (location) parts.push(location);
  if (addr.country) parts.push(addr.country);

  return parts;
}

function formatCurrency(amount, currency = 'SEK') {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency }).format(n);
}

function getCustomerPhone(customer) {
  if (!customer || typeof customer !== 'object') return '';
  return customer.phone || customer.phone_mobile || customer.phoneMobile || '';
}

function getCustomerEmail(customer) {
  if (!customer || typeof customer !== 'object') return '';
  return customer.email || customer.email_address || '';
}

function formatChannelLabel(channel) {
  const ch = String(channel || '').toLowerCase();
  if (ch === 'woocommerce') return 'specifika WooCommerce-butiken';
  if (ch === 'cdon') return 'CDON';
  if (ch === 'fyndiq') return 'Fyndiq';
  return ch || '—';
}

/**
 * Generate HTML for plocklista PDF. Each order in orders has: order fields (id, orderNumber, platformOrderNumber, channelOrderId, shippingAddress, customer, totalAmount, currency, items) plus ordersumma and frakt (numbers).
 * @param {Array<{ order: object, ordersumma: number, frakt: number|null }>} orders
 * @returns {string} HTML string
 */
function escapeHtml(s) {
  if (s == null) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function generatePlocklistaHTML(orders) {
  if (!Array.isArray(orders) || orders.length === 0) {
    return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Plocklista</title></head>
<body><p>Inga order att visa.</p></body></html>`;
  }

  const sections = orders.map(({ order, ordersumma, frakt }) => {
    const addr = order.shippingAddress || (order.customer && order.customer.shippingAddress);
    const addrLines = formatAddress(addr);
    const phone = getCustomerPhone(order.customer);
    const email = getCustomerEmail(order.customer);
    const orderNr = order.orderNumber != null ? String(order.orderNumber) : order.id || '—';
    const platformLabel = order.platformLabel != null ? String(order.platformLabel) : formatChannelLabel(order.channel);
    const orderNrPlatform = order.platformOrderNumber || order.channelOrderId || '—';
    const currency = order.currency || 'SEK';
    const totalAmount = order.totalAmount != null ? Number(order.totalAmount) : null;
    const fraktDisplay = frakt != null && Number.isFinite(frakt) ? formatCurrency(frakt, currency) : '—';
    const totalDisplay = totalAmount != null && Number.isFinite(totalAmount) ? formatCurrency(totalAmount, currency) : '—';
    const ordersummaDisplay = ordersumma != null && Number.isFinite(ordersumma) ? formatCurrency(ordersumma, currency) : '—';

    const items = Array.isArray(order.items) ? order.items : [];
    const rows = items
      .map(
        (it) => `
        <tr>
          <td class="cell">—</td>
          <td class="cell">${escapeHtml(it.sku != null && it.sku !== '' ? String(it.sku) : '—')}</td>
          <td class="cell num">${escapeHtml(String(it.quantity ?? ''))}</td>
          <td class="cell">${escapeHtml(it.title || '—')}</td>
          <td class="cell">—</td>
          <td class="cell ck"><input type="checkbox" disabled /></td>
        </tr>`,
      )
      .join('');

    return `
    <section class="order-block">
      <div class="order-meta">
        <div class="address-block">
          ${addrLines.length ? addrLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('') : '<div>—</div>'}
        </div>
        <div class="ids-block">
          <div><span class="label">Ordernummer:</span> ${escapeHtml(orderNr)}</div>
          <div><span class="label">Ordernummer (${escapeHtml(platformLabel)}):</span> ${escapeHtml(orderNrPlatform)}</div>
          <div><span class="label">Telefon:</span> ${escapeHtml(phone || '—')}</div>
          <div><span class="label">E-post:</span> ${escapeHtml(email || '—')}</div>
        </div>
      </div>
      <table class="items-table">
        <thead>
          <tr>
            <th class="cell">SKU</th>
            <th class="cell">Produkt-ID</th>
            <th class="cell num">Antal</th>
            <th class="cell">Produkttitel</th>
            <th class="cell">Lagerplats</th>
            <th class="cell ck">Plockad</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="6" class="cell">Inga rader</td></tr>'}
        </tbody>
      </table>
      <div class="sums">
        <span class="sum-row"><span class="label">Ordersumma:</span> ${ordersummaDisplay}</span>
        <span class="sum-row"><span class="label">Fraktkostnad:</span> ${fraktDisplay}</span>
        <span class="sum-row total"><span class="label">Totalsumma:</span> ${totalDisplay}</span>
      </div>
    </section>`;
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Plocklista</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; margin: 0; padding: 12px; font-size: 11px; }
    .order-block { border-bottom: 1px solid #ccc; margin-bottom: 12px; padding-bottom: 12px; }
    .order-block:last-child { border-bottom: none; }
    .order-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 8px; }
    .address-block, .ids-block { min-width: 180px; }
    .label { font-weight: 600; color: #374151; margin-right: 4px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
    .items-table th, .items-table td { padding: 4px 6px; border: 1px solid #e5e7eb; text-align: left; }
    .items-table th { background: #f3f4f6; }
    .cell.num { text-align: right; }
    .cell.ck { text-align: center; width: 48px; }
    .sums { margin-top: 6px; display: flex; gap: 16px; flex-wrap: wrap; }
    .sum-row { font-size: 11px; }
    .sum-row.total { font-weight: 700; }
  </style>
</head>
<body>
  <h1 style="margin: 0 0 12px 0; font-size: 16px;">Plocklista</h1>
  ${sections.join('')}
</body>
</html>`;
}

module.exports = { formatAddress, generatePlocklistaHTML };
