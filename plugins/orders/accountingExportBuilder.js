// plugins/orders/accountingExportBuilder.js
// Excel (bokföringsunderlag) from flat SQL rows joined with products.

const XLSX = require('xlsx');

const HEADERS = [
  'Marknadsplats',
  'Marknadsplatsens ordernummer',
  'Homebase ordernummer',
  'Status',
  'Butikens artikelnummer',
  'Homebase artikelnummer',
  'Egen referens (SKU)',
  'Titel',
  'Private name',
  'Kundens namn',
  'Kundens adress',
  'Kundens adress 2',
  'Kundens postnummer',
  'Kundens stad',
  'Kundens land',
  'Kundens e-mail',
  'Kundens telefon',
  'Skapad',
  'Inköpspris',
  'Antal',
  'Pris/st',
  'Frakt',
  'Total inkl moms',
  'Total inkl moms och frakt',
  'Valuta',
  'Betalningsmetod',
  'Betalningsreferens',
  'Lagerplats',
  'Marknadsplatsens rad-referens',
  'Moms 25.00%',
  'Moms 12.00%',
];

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

function parseJsonField(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

function isWooShippingLine(channel, row) {
  if (String(channel || '').toLowerCase() !== 'woocommerce') return false;
  const pid = row.product_id != null ? Number(row.product_id) : null;
  if (pid != null && Number.isFinite(pid)) return false;
  const raw = parseJsonField(row.line_raw);
  if (!raw || typeof raw !== 'object') return false;
  return raw.method_id != null;
}

function customerAddressParts(shipping, billing, customer) {
  const addr = shipping && typeof shipping === 'object' ? shipping : null;
  const bill = billing && typeof billing === 'object' ? billing : null;
  const use = addr || bill || {};
  const c = customer && typeof customer === 'object' ? customer : {};

  let name = '';
  if (use.full_name || use.fullName) name = String(use.full_name || use.fullName);
  else {
    const n = [use.first_name, use.last_name].filter(Boolean).join(' ').trim();
    name = n || '';
  }

  let line1 = '';
  let line2 = '';
  if (use.street_address || use.streetAddress) {
    line1 = String(use.street_address || use.streetAddress);
  } else {
    line1 = use.address_1 != null ? String(use.address_1) : '';
    line2 = use.address_2 != null ? String(use.address_2) : '';
  }
  const postal = use.postcode || use.postal_code || use.postalCode || '';
  const city = use.city != null ? String(use.city) : '';
  const country = use.country != null ? String(use.country) : '';

  const email = c.email || c.email_address || '';
  const phone = c.phone || c.phone_mobile || c.phoneMobile || '';

  return {
    name,
    line1,
    line2,
    postal: postal != null ? String(postal) : '',
    city,
    country,
    email: email != null ? String(email) : '',
    phone: phone != null ? String(phone) : '',
  };
}

function extractPayment(orderRaw) {
  const r = parseJsonField(orderRaw);
  if (!r || typeof r !== 'object') return { method: '', reference: '' };
  const method =
    r.payment_method_title != null && String(r.payment_method_title).trim() !== ''
      ? String(r.payment_method_title).trim()
      : r.payment_method != null
        ? String(r.payment_method).trim()
        : '';
  let reference =
    r.transaction_id != null && String(r.transaction_id).trim() !== ''
      ? String(r.transaction_id).trim()
      : '';
  if (!reference && r.meta_data && Array.isArray(r.meta_data)) {
    const tx = r.meta_data.find(
      (m) =>
        m &&
        typeof m === 'object' &&
        (String(m.key || '').includes('transaction') || String(m.key || '') === '_transaction_id'),
    );
    if (tx?.value != null) reference = String(tx.value).trim();
  }
  return { method, reference };
}

function extractStoreArticleNumber(channel, lineRaw, itemSku) {
  if (itemSku != null && String(itemSku).trim() !== '') return String(itemSku).trim();
  const raw = parseJsonField(lineRaw);
  if (!raw || typeof raw !== 'object') return '';
  const ch = String(channel || '').toLowerCase();
  if (ch === 'woocommerce') {
    if (raw.sku != null && String(raw.sku).trim() !== '') return String(raw.sku).trim();
    if (raw.product_id != null) return String(raw.product_id);
  }
  if (raw.article_id != null) return String(raw.article_id);
  if (raw.id != null) return String(raw.id);
  return '';
}

function extractLineReference(lineRaw) {
  const raw = parseJsonField(lineRaw);
  if (!raw || typeof raw !== 'object') return '';
  if (raw.id != null) return String(raw.id);
  if (raw.line_id != null) return String(raw.line_id);
  if (raw.order_row_id != null) return String(raw.order_row_id);
  return '';
}

function vatAmountsForLine(gross, vatRatePercent) {
  const grossN = Number(gross);
  if (!Number.isFinite(grossN)) return { v25: '', v12: '' };
  const r =
    vatRatePercent != null && Number.isFinite(Number(vatRatePercent)) ? Number(vatRatePercent) : 25;
  const vatTotal = grossN - grossN / (1 + r / 100);
  const rounded = roundMoney(vatTotal);
  if (Math.abs(r - 12) < 0.05) {
    return { v25: '', v12: rounded };
  }
  return { v25: rounded, v12: '' };
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function groupRowsByOrderId(flatRows) {
  const map = new Map();
  for (const row of flatRows) {
    const oid = row.order_id;
    if (!map.has(oid)) map.set(oid, []);
    map.get(oid).push(row);
  }
  return map;
}

/**
 * @param {object[]} flatRows - from OrdersModel.getAccountingExportLineRows
 * @param {Record<string, string>|null} channelLabels - orderId string -> display name
 */
function buildAccountingRows(flatRows, channelLabels) {
  if (!Array.isArray(flatRows) || flatRows.length === 0) return [];

  const byOrder = groupRowsByOrderId(flatRows);
  const out = [];

  for (const [, rows] of byOrder) {
    const first = rows[0];
    const channel = String(first.channel || '');
    const orderRaw = first.order_raw;
    const shipping = parseJsonField(first.shipping_address);
    const billing = parseJsonField(first.billing_address);
    const customer = parseJsonField(first.customer);
    const addr = customerAddressParts(shipping, billing, customer);
    const payment = extractPayment(orderRaw);
    const marketplaceOrder =
      first.platform_order_number != null && String(first.platform_order_number).trim() !== ''
        ? String(first.platform_order_number).trim()
        : first.channel_order_id != null
          ? String(first.channel_order_id).trim()
          : '';
    const hbOrderNr =
      first.order_number != null && Number.isFinite(Number(first.order_number))
        ? Number(first.order_number)
        : '';
    const status = first.status != null ? String(first.status) : '';
    const currency = first.currency != null ? String(first.currency).toUpperCase() : 'SEK';
    const created = first.created_at
      ? new Date(first.created_at).toISOString().slice(0, 19).replace('T', ' ')
      : '';

    const labelOverride =
      channelLabels != null && first.order_id != null
        ? channelLabels[String(first.order_id)]
        : null;
    const marknadsplats =
      labelOverride != null && String(labelOverride).trim() !== ''
        ? String(labelOverride).trim()
        : formatChannelLabel(channel, first.channel_label);

    const productRows = rows.filter((r) => !isWooShippingLine(channel, r));
    let productGrossSum = 0;
    for (const r of productRows) {
      const qty = Number(r.quantity);
      const unit = r.unit_price != null ? Number(r.unit_price) : 0;
      if (Number.isFinite(qty) && Number.isFinite(unit)) productGrossSum += qty * unit;
    }

    let fraktTotal = 0;
    const chLower = channel.toLowerCase();
    if (chLower === 'woocommerce') {
      for (const r of rows) {
        if (isWooShippingLine(channel, r)) {
          const qty = Number(r.quantity);
          const unit = r.unit_price != null ? Number(r.unit_price) : 0;
          if (Number.isFinite(qty) && Number.isFinite(unit)) fraktTotal += qty * unit;
        }
      }
    } else {
      const total = first.total_amount != null ? Number(first.total_amount) : null;
      if (total != null && Number.isFinite(total) && productGrossSum >= 0) {
        fraktTotal = Math.max(0, total - productGrossSum);
      }
    }

    productRows.forEach((r, idx) => {
      const qty = Number(r.quantity);
      const unit = r.unit_price != null ? Number(r.unit_price) : 0;
      const lineGross = Number.isFinite(qty) && Number.isFinite(unit) ? qty * unit : null;
      let fraktLine = 0;
      if (fraktTotal > 0 && lineGross != null) {
        if (productGrossSum > 0) {
          fraktLine = roundMoney((lineGross / productGrossSum) * fraktTotal);
        } else if (idx === 0) {
          fraktLine = roundMoney(fraktTotal);
        }
      }
      const totalInklMoms = lineGross != null ? roundMoney(lineGross) : '';
      const totalMedFrakt = lineGross != null ? roundMoney(lineGross + fraktLine) : '';

      const storeArticle = extractStoreArticleNumber(channel, r.line_raw, r.item_sku);
      const homebaseArticle = r.product_table_id != null ? String(r.product_table_id) : '';
      const egenRef =
        r.product_catalog_sku != null && String(r.product_catalog_sku).trim() !== ''
          ? String(r.product_catalog_sku).trim()
          : '';
      const privateName = r.private_name != null ? String(r.private_name) : '';
      const title = r.item_title != null ? String(r.item_title) : '';
      const purchase =
        r.purchase_price != null && Number.isFinite(Number(r.purchase_price))
          ? Number(r.purchase_price)
          : '';
      const lager = r.lagerplats != null ? String(r.lagerplats) : '';
      const lineRef = extractLineReference(r.line_raw);
      const vr = r.vat_rate != null ? Number(r.vat_rate) : 25;
      const { v25, v12 } =
        lineGross != null && Number.isFinite(lineGross)
          ? vatAmountsForLine(lineGross, vr)
          : { v25: '', v12: '' };

      out.push({
        [HEADERS[0]]: marknadsplats,
        [HEADERS[1]]: marketplaceOrder,
        [HEADERS[2]]: hbOrderNr,
        [HEADERS[3]]: status,
        [HEADERS[4]]: storeArticle,
        [HEADERS[5]]: homebaseArticle,
        [HEADERS[6]]: egenRef,
        [HEADERS[7]]: title,
        [HEADERS[8]]: privateName,
        [HEADERS[9]]: addr.name,
        [HEADERS[10]]: addr.line1,
        [HEADERS[11]]: addr.line2,
        [HEADERS[12]]: addr.postal,
        [HEADERS[13]]: addr.city,
        [HEADERS[14]]: addr.country,
        [HEADERS[15]]: addr.email,
        [HEADERS[16]]: addr.phone,
        [HEADERS[17]]: created,
        [HEADERS[18]]: purchase,
        [HEADERS[19]]: Number.isFinite(qty) ? qty : '',
        [HEADERS[20]]: Number.isFinite(unit) ? unit : '',
        [HEADERS[21]]: fraktLine,
        [HEADERS[22]]: totalInklMoms,
        [HEADERS[23]]: totalMedFrakt,
        [HEADERS[24]]: currency,
        [HEADERS[25]]: payment.method,
        [HEADERS[26]]: payment.reference,
        [HEADERS[27]]: lager,
        [HEADERS[28]]: lineRef,
        [HEADERS[29]]: v25,
        [HEADERS[30]]: v12,
      });
    });
  }

  return out;
}

function buildAccountingXlsxBuffer(rows) {
  const ws = XLSX.utils.json_to_sheet(rows, { header: HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bokföring');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  HEADERS,
  buildAccountingRows,
  buildAccountingXlsxBuffer,
};
