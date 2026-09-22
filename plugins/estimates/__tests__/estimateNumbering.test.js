const { resolveEstimateNumbering } = require('../estimateNumbering');
const { buildInvoiceNumber } = require('../../invoices/invoiceNumbering');

describe('estimateNumbering', () => {
  test('uses flat settings keys like invoices', () => {
    const resolved = resolveEstimateNumbering({
      numberPrefix: 'OFF',
      numberStart: 5,
      includeYear: true,
    });
    expect(resolved.numberPrefix).toBe('OFF');
    expect(resolved.numberStart).toBe(5);
    expect(resolved.includeYear).toBe(true);
    expect(buildInvoiceNumber('OFF', 2026, 5, true)).toBe('OFF-2026-005');
  });

  test('defaults when settings missing', () => {
    const resolved = resolveEstimateNumbering(null);
    expect(resolved.numberStart).toBe(1);
    expect(resolved.includeYear).toBe(true);
  });
});
