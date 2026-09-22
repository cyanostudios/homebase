const { calculateEstimateTotals } = require('../estimateTotals');
const { calculateInvoiceTotals } = require('../../invoices/invoiceTotals');

describe('estimateTotals', () => {
  const pricedAndText = [
    { kind: 'item', quantity: 2, unitPrice: 100, discount: 0, vatRate: 25 },
    { kind: 'text', description: 'Info only' },
    { kind: 'item', quantity: 1, unitPrice: 50, discount: 0, vatRate: 25 },
  ];

  test('skips text rows (mirrors invoiceTotals)', () => {
    const estimateTotals = calculateEstimateTotals(pricedAndText, 0);
    const invoiceTotals = calculateInvoiceTotals(pricedAndText, 0);
    expect(estimateTotals.subtotal).toBe(invoiceTotals.subtotal);
    expect(estimateTotals.total).toBe(invoiceTotals.total);
    expect(estimateTotals.subtotal).toBe(250);
  });

  test('maps invoice discount field names to estimate names', () => {
    const totals = calculateEstimateTotals(pricedAndText, 10);
    expect(totals).toHaveProperty('estimateDiscountAmount');
    expect(totals).toHaveProperty('subtotalAfterEstimateDiscount');
    expect(totals.estimateDiscountAmount).toBeGreaterThan(0);
  });
});
