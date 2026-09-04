import { calculateInvoiceLineItem } from '../../types/invoices';
import {
  calculateInvoiceTotals,
  resolveInvoiceTotals,
  withResolvedInvoiceTotals,
} from '../invoiceTotals';

// Canonical server module — must stay in parity with the client implementation.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  calculateInvoiceTotals: serverCalculate,
} = require('../../../../../../plugins/invoices/invoiceTotals.js');

describe('invoice totals — single derivation path', () => {
  const mixedLines = [
    calculateInvoiceLineItem({
      id: '1',
      description: 'A',
      quantity: 1,
      unitPrice: 1000,
      discount: 10,
      vatRate: 25,
    }),
    calculateInvoiceLineItem({
      id: '2',
      description: 'B',
      quantity: 1,
      unitPrice: 500,
      discount: 0,
      vatRate: 25,
    }),
  ];

  it('calculateInvoiceTotals applies line then invoice discount with VAT on final net', () => {
    const totals = calculateInvoiceTotals(mixedLines, 10);
    expect(totals.subtotal).toBe(1500);
    expect(totals.totalDiscount).toBe(100);
    expect(totals.subtotalAfterDiscount).toBe(1400);
    expect(totals.invoiceDiscountAmount).toBe(140);
    expect(totals.subtotalAfterInvoiceDiscount).toBe(1260);
    expect(totals.totalVat).toBe(315);
    expect(totals.total).toBe(1575);
  });

  it('resolveInvoiceTotals matches calculateInvoiceTotals for invoices with lines', () => {
    const source = { lineItems: mixedLines, invoiceDiscount: 10, total: 9999 };
    expect(resolveInvoiceTotals(source)).toEqual(calculateInvoiceTotals(mixedLines, 10));
  });

  it('withResolvedInvoiceTotals stamps derived fields onto the invoice', () => {
    const stamped = withResolvedInvoiceTotals({
      id: 'x',
      lineItems: mixedLines,
      invoiceDiscount: 10,
      total: 0,
    });
    expect(stamped.total).toBe(1575);
    expect(stamped.totalVat).toBe(315);
  });

  it('stays in parity with server invoiceTotals.js', () => {
    expect(serverCalculate(mixedLines, 10)).toEqual(calculateInvoiceTotals(mixedLines, 10));
  });

  it('derives discountAmount from discount % when amount is missing', () => {
    const totals = calculateInvoiceTotals(
      [
        {
          id: '1',
          description: 'A',
          quantity: 2,
          unitPrice: 100,
          discount: 25,
          vatRate: 25,
          lineSubtotal: 200,
          lineSubtotalAfterDiscount: 0,
          vatAmount: 0,
          lineTotal: 0,
          sortOrder: 0,
          unit: 'st',
        } as any,
      ],
      0,
    );
    expect(totals.totalDiscount).toBe(50);
    expect(totals.total).toBe(187.5);
  });

  it('ignores text rows', () => {
    const totals = calculateInvoiceTotals(
      [
        calculateInvoiceLineItem({ id: 't', kind: 'text', description: 'Note' }),
        calculateInvoiceLineItem({
          id: '1',
          description: 'A',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          vatRate: 25,
        }),
      ],
      0,
    );
    expect(totals.subtotal).toBe(100);
    expect(totals.total).toBe(125);
  });
});
