const {
  calculateInvoiceTotals,
  resolveInvoiceTotals,
  withResolvedInvoiceTotals,
} = require('../invoiceTotals');
const InvoiceModel = require('../model');

describe('plugins/invoices/invoiceTotals (canonical)', () => {
  const lineItems = [
    {
      kind: 'item',
      quantity: 1,
      unitPrice: 1000,
      discount: 10,
      vatRate: 25,
      lineSubtotal: 1000,
      discountAmount: 100,
    },
    {
      kind: 'item',
      quantity: 1,
      unitPrice: 500,
      discount: 0,
      vatRate: 25,
      lineSubtotal: 500,
      discountAmount: 0,
    },
  ];

  it('matches model.calculateTotals wrapper', () => {
    const model = new InvoiceModel();
    expect(model.calculateTotals(lineItems, 10)).toEqual(calculateInvoiceTotals(lineItems, 10));
  });

  it('resolve + withResolved stamp the same numbers', () => {
    const totals = resolveInvoiceTotals({ lineItems, invoiceDiscount: 10, total: 1 });
    expect(totals.total).toBe(1575);
    expect(withResolvedInvoiceTotals({ lineItems, invoiceDiscount: 10 }).total).toBe(1575);
  });

  it('does not keep pre-invoice-discount VAT when invoice discount is set', () => {
    const totals = calculateInvoiceTotals(
      [
        {
          quantity: 1,
          unitPrice: 1000,
          discount: 0,
          vatRate: 25,
          vatAmount: 250,
        },
      ],
      20,
    );
    expect(totals.subtotalAfterInvoiceDiscount).toBe(800);
    expect(totals.totalVat).toBe(200);
    expect(totals.total).toBe(1000);
  });
});
