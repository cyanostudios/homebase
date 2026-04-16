// plugins/orders/ordersPdfCommon.js
// Shared HTML/PDF helpers for order exports (plocklista, kvitto).

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

function formatChannelLabel(channel, channelLabel) {
  const ch = String(channel || '').toLowerCase();
  if (ch === 'woocommerce') {
    const label = channelLabel != null ? String(channelLabel).trim() : '';
    return label !== '' ? label : '—';
  }
  if (ch === 'cdon') return 'CDON';
  if (ch === 'fyndiq') return 'Fyndiq';
  return ch || '—';
}

function escapeHtml(s) {
  if (s == null) return '';
  const str = String(s);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Format placed_at / placedAt for display (ISO string or Date). */
function formatPlacedAt(placedAt) {
  if (placedAt == null) return '—';
  const d = placedAt instanceof Date ? placedAt : new Date(placedAt);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * Aggregate VAT assuming line amounts are gross (inkl. moms).
 * @param {Array<{ quantity?: number, unitPrice?: number|null, vatRate?: number|null }>} items
 * @param {number|null} fraktGross - shipping gross; VAT at 25% if SE default
 * @returns {{ vatByRate: Record<number, number>, netTotal: number, totalVat: number }}
 */
function aggregateVatInklMoms(items, fraktGross) {
  const vatByRate = {};
  let netTotal = 0;

  const addLine = (gross, ratePercent) => {
    if (!Number.isFinite(gross) || gross <= 0) return;
    const r = Number.isFinite(ratePercent) && ratePercent >= 0 ? ratePercent : 25;
    const net = gross / (1 + r / 100);
    const vat = gross - net;
    netTotal += net;
    const key = Math.round(r * 100) / 100;
    vatByRate[key] = (vatByRate[key] || 0) + vat;
  };

  const arr = Array.isArray(items) ? items : [];
  for (const it of arr) {
    const qty = Number(it.quantity);
    const unit = it.unitPrice != null ? Number(it.unitPrice) : 0;
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) continue;
    const gross = qty * unit;
    const rate =
      it.vatRate != null && Number.isFinite(Number(it.vatRate)) ? Number(it.vatRate) : 25;
    addLine(gross, rate);
  }

  if (fraktGross != null && Number.isFinite(fraktGross) && fraktGross > 0) {
    addLine(fraktGross, 25);
  }

  const totalVat = Object.values(vatByRate).reduce((a, b) => a + b, 0);
  return { vatByRate, netTotal, totalVat };
}

module.exports = {
  formatAddress,
  formatCurrency,
  getCustomerPhone,
  getCustomerEmail,
  formatChannelLabel,
  escapeHtml,
  formatPlacedAt,
  aggregateVatInklMoms,
};
