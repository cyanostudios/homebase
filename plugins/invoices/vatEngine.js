/**
 * Domestic SEK VAT engine v1 (Architect epic D + C gate helpers).
 * Expert food-window dates are external input — constants annotated for Legal re-check.
 */

const ALLOWED_VAT_RATES = [0, 6, 12, 25];
const FORENKLAD_TOTAL_CEILING_SEK = 4000;

/** Expert input SFS 2026:118 — re-check with Legal–Skatteverket before compliance claims. */
const FOOD_VAT_WINDOW = {
  start: '2026-04-01',
  end: '2027-12-31',
};

function isIssuedStatus(status) {
  return String(status || 'draft').trim() !== 'draft';
}

function normalizeCurrency(currency) {
  return (
    String(currency || 'SEK')
      .trim()
      .toUpperCase() || 'SEK'
  );
}

function isAllowedVatRate(rate) {
  const n = Number(rate);
  return ALLOWED_VAT_RATES.includes(n);
}

function deriveContentProfile({ invoiceType, currency, total }) {
  const type = String(invoiceType || 'invoice').trim();
  if (type === 'invoice' || type === 'credit_note') {
    return 'full';
  }
  if (type !== 'receipt' && type !== 'cash_invoice') {
    return 'full';
  }
  const cur = normalizeCurrency(currency);
  const totalInclVat = Math.abs(Number(total || 0));
  if (cur === 'SEK' && totalInclVat <= FORENKLAD_TOTAL_CEILING_SEK) {
    return 'simplified';
  }
  return 'full';
}

function dateOnlyIso(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isFoodRateAllowed(supplyDate) {
  const day = dateOnlyIso(supplyDate);
  if (!day) return false;
  return day >= FOOD_VAT_WINDOW.start && day <= FOOD_VAT_WINDOW.end;
}

/**
 * Per-rate tax base + VAT after discounts (mirrors client buildInvoiceVatBreakdown).
 */
function buildVatBreakdown(lineItems, invoiceDiscount = 0) {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return [];
  }

  const pricedItems = lineItems.filter((item) => item && item.kind !== 'text');
  let subtotal = 0;
  let totalDiscount = 0;
  pricedItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
    subtotal += lineSubtotal;
    totalDiscount += discountAmount;
  });

  const subtotalAfterDiscount = subtotal - totalDiscount;
  const invoiceDiscountAmount = subtotalAfterDiscount * (Number(invoiceDiscount || 0) / 100);
  const subtotalAfterInvoiceDiscount = subtotalAfterDiscount - invoiceDiscountAmount;

  const byRate = new Map();

  pricedItems.forEach((item) => {
    const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
    const lineDiscountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
    const lineAfterDiscount = lineSubtotal - lineDiscountAmount;
    const rate = Number(item.vatRate ?? 25);
    let taxBase = 0;
    let vatAmount = 0;
    if (subtotalAfterDiscount > 0) {
      const proportion = lineAfterDiscount / subtotalAfterDiscount;
      taxBase = subtotalAfterInvoiceDiscount * proportion;
      vatAmount = taxBase * (rate / 100);
    }
    const prev = byRate.get(rate) || { taxBase: 0, vatAmount: 0 };
    byRate.set(rate, {
      taxBase: prev.taxBase + taxBase,
      vatAmount: prev.vatAmount + vatAmount,
    });
  });

  return [...byRate.entries()]
    .filter(([, row]) => Math.abs(row.taxBase) > 0.0001 || Math.abs(row.vatAmount) > 0.0001)
    .sort((a, b) => b[0] - a[0])
    .map(([rate, row]) => ({
      rate,
      taxBase: Math.round(row.taxBase * 100) / 100,
      vatAmount: Math.round(row.vatAmount * 100) / 100,
    }));
}

function detectRefusedVatPosture(invoiceData) {
  const mode = String(invoiceData?.vatMode || invoiceData?.vatPosture || '')
    .trim()
    .toLowerCase();
  if (['reverse_charge', 'rc', 'exemption', 'exempt', 'export'].includes(mode)) {
    return mode;
  }
  const lines = Array.isArray(invoiceData?.lineItems) ? invoiceData.lineItems : [];
  for (const line of lines) {
    const lineMode = String(line?.vatMode || line?.vatPosture || '')
      .trim()
      .toLowerCase();
    if (['reverse_charge', 'rc', 'exemption', 'exempt', 'export'].includes(lineMode)) {
      return lineMode;
    }
  }
  return null;
}

/**
 * Validate currency, rates, food window, refused postures.
 * @returns {{ ok: true } | { ok: false, code: string, message: string, field?: string }}
 */
function validateVatEngine(invoiceData, { supplyDate, issuing }) {
  const refused = detectRefusedVatPosture(invoiceData);
  if (refused) {
    return {
      ok: false,
      code: 'VAT_POSTURE_REFUSED',
      field: 'vatMode',
      message: 'This VAT treatment is not supported yet.',
    };
  }

  const lines = Array.isArray(invoiceData?.lineItems) ? invoiceData.lineItems : [];
  for (const item of lines) {
    if (item?.kind === 'text') continue;
    const rate = item?.vatRate ?? 25;
    if (!isAllowedVatRate(rate)) {
      return {
        ok: false,
        code: 'VAT_RATE_INVALID',
        field: 'lineItems',
        message: 'VAT rate must be 0%, 6%, 12%, or 25%.',
      };
    }
    if (
      String(item?.vatCategory || '')
        .trim()
        .toLowerCase() === 'food' &&
      Number(rate) === 6 &&
      issuing &&
      !isFoodRateAllowed(supplyDate)
    ) {
      return {
        ok: false,
        code: 'FOOD_VAT_WINDOW',
        field: 'lineItems',
        message: 'Food VAT 6% is only allowed within the temporary supply-date window.',
      };
    }
  }

  return { ok: true };
}

/**
 * Fail-closed förenklad: invoice/credit_note must be full; receipt/cash simplified only under gate.
 */
function validateContentProfile({ invoiceType, contentProfile, currency, total }) {
  const type = String(invoiceType || 'invoice').trim();
  const derived = deriveContentProfile({ invoiceType: type, currency, total });
  const requested = String(contentProfile || derived).trim() || derived;

  if (type === 'invoice' || type === 'credit_note') {
    if (requested === 'simplified') {
      return {
        ok: false,
        code: 'CONTENT_PROFILE_INVALID',
        field: 'contentProfile',
        message: 'Invoices and credit notes require the full field set.',
      };
    }
    return { ok: true, contentProfile: 'full' };
  }

  if (requested === 'simplified' && derived !== 'simplified') {
    return {
      ok: false,
      code: 'FORENKLAD_GATE',
      field: 'contentProfile',
      message: `Simplified documents require SEK and total incl. VAT ≤ ${FORENKLAD_TOTAL_CEILING_SEK}.`,
    };
  }

  return { ok: true, contentProfile: derived };
}

module.exports = {
  ALLOWED_VAT_RATES,
  FORENKLAD_TOTAL_CEILING_SEK,
  FOOD_VAT_WINDOW,
  isIssuedStatus,
  normalizeCurrency,
  isAllowedVatRate,
  deriveContentProfile,
  buildVatBreakdown,
  validateVatEngine,
  validateContentProfile,
  detectRefusedVatPosture,
  isFoodRateAllowed,
};
