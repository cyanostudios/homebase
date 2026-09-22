/**
 * Estimate money math — mirrors plugins/invoices/invoiceTotals (skips kind === 'text').
 */

const { calculateInvoiceTotals } = require('../invoices/invoiceTotals');

function calculateEstimateTotals(lineItems, estimateDiscount = 0) {
  const raw = calculateInvoiceTotals(lineItems, estimateDiscount);
  return {
    subtotal: raw.subtotal,
    totalDiscount: raw.totalDiscount,
    subtotalAfterDiscount: raw.subtotalAfterDiscount,
    estimateDiscountAmount: raw.invoiceDiscountAmount,
    subtotalAfterEstimateDiscount: raw.subtotalAfterInvoiceDiscount,
    totalVat: raw.totalVat,
    total: raw.total,
  };
}

function normalizeEstimateLineItems(lineItems) {
  if (!Array.isArray(lineItems)) {
    return [];
  }
  return lineItems.map((item) => {
    if (!item || typeof item !== 'object') {
      return item;
    }
    const kind = item.kind === 'text' ? 'text' : 'item';
    return { ...item, kind };
  });
}

module.exports = {
  calculateEstimateTotals,
  normalizeEstimateLineItems,
};
