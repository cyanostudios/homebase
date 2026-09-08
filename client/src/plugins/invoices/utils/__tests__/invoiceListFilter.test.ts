import {
  invoiceMatchesListFilters,
  invoiceMatchesSingleFilter,
  toggleInvoiceListFilter,
} from '../invoiceListFilter';
import { computeInvoiceStats } from '../invoiceStats';

describe('invoiceMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(invoiceMatchesListFilters({ invoiceType: 'invoice' }, [])).toBe(true);
  });

  it('matches exclusive document types', () => {
    expect(invoiceMatchesListFilters({ invoiceType: 'invoice' }, ['invoice'])).toBe(true);
    expect(invoiceMatchesListFilters({ invoiceType: 'credit_note' }, ['invoice'])).toBe(false);
    expect(invoiceMatchesListFilters({ invoiceType: 'cash_invoice' }, ['cash_invoice'])).toBe(true);
    expect(invoiceMatchesListFilters({ invoiceType: 'receipt' }, ['receipt'])).toBe(true);
  });

  it('treats missing invoiceType as invoice', () => {
    expect(invoiceMatchesSingleFilter({}, 'invoice')).toBe(true);
    expect(invoiceMatchesSingleFilter({ invoiceType: null }, 'credit_note')).toBe(false);
  });
});

describe('toggleInvoiceListFilter', () => {
  it('replaces within exclusive type group', () => {
    expect(toggleInvoiceListFilter(['invoice'], 'credit_note')).toEqual(['credit_note']);
    expect(toggleInvoiceListFilter(['credit_note'], 'receipt')).toEqual(['receipt']);
    expect(toggleInvoiceListFilter(['receipt'], 'receipt')).toEqual([]);
    expect(toggleInvoiceListFilter(['cash_invoice'], 'invoice')).toEqual(['invoice']);
  });
});

describe('computeInvoiceStats', () => {
  it('aggregates outstanding overdue paid and partially paid per currency', () => {
    const stats = computeInvoiceStats([
      { id: '1', status: 'sent', total: 100, amountPaid: 0, currency: 'SEK' },
      { id: '2', status: 'overdue', total: 50, amountPaid: 10, currency: 'SEK' },
      { id: '3', status: 'paid', total: 200, amountPaid: 200, currency: 'SEK' },
      { id: '4', status: 'draft', total: 30, amountPaid: 0, currency: 'SEK' },
      { id: '5', status: 'partially_paid', total: 80, amountPaid: 20, currency: 'SEK' },
    ] as any);

    expect(stats.sent.count).toBe(1);
    expect(stats.overdue.count).toBe(1);
    expect(stats.paid.count).toBe(1);
    expect(stats.draft.count).toBe(1);
    expect(stats.partiallyPaid.count).toBe(1);
    expect(stats.outstanding.byCurrency.SEK).toBe(200);
    expect(stats.partialPayments).toBe(2);
    expect(stats.totalCollectedByCurrency.SEK).toBe(230);
    expect(stats.invoiceCount).toBe(5);
    expect(stats.currencies).toEqual(['SEK']);
  });

  it('subtracts credit notes from totalInvoiced and outstanding', () => {
    const stats = computeInvoiceStats([
      {
        id: '1',
        status: 'sent',
        invoiceType: 'invoice',
        currency: 'SEK',
        lineItems: [{ kind: 'item', quantity: 1, unitPrice: 1000, vatRate: 0 }],
        amountPaid: 0,
      },
      {
        id: '2',
        status: 'sent',
        invoiceType: 'credit_note',
        currency: 'SEK',
        lineItems: [{ kind: 'item', quantity: 1, unitPrice: 250, vatRate: 0 }],
        amountPaid: 0,
      },
    ] as any);

    expect(stats.totalInvoicedByCurrency.SEK).toBe(750);
    expect(stats.sent.byCurrency.SEK).toBe(750);
    expect(stats.outstanding.byCurrency.SEK).toBe(750);
    expect(stats.totalCollectedByCurrency.SEK || 0).toBe(0);
    expect(stats.byType.invoice.count).toBe(1);
    expect(stats.byType.credit_note.count).toBe(1);
    expect(stats.byType.invoice.byCurrency.SEK).toBe(1000);
    expect(stats.byType.credit_note.byCurrency.SEK).toBe(-250);
  });

  it('keeps SEK and EUR amounts separate (no FX mix)', () => {
    const stats = computeInvoiceStats([
      {
        id: '1',
        status: 'sent',
        currency: 'SEK',
        lineItems: [{ kind: 'item', quantity: 1, unitPrice: 1000, vatRate: 0 }],
        amountPaid: 0,
      },
      {
        id: '2',
        status: 'sent',
        currency: 'EUR',
        lineItems: [{ kind: 'item', quantity: 1, unitPrice: 200, vatRate: 0 }],
        amountPaid: 0,
      },
    ] as any);

    expect(stats.currencies).toEqual(['SEK', 'EUR']);
    expect(stats.totalInvoicedByCurrency.SEK).toBe(1000);
    expect(stats.totalInvoicedByCurrency.EUR).toBe(200);
    expect(stats.outstanding.byCurrency.SEK).toBe(1000);
    expect(stats.outstanding.byCurrency.EUR).toBe(200);
    expect(stats.sent.count).toBe(2);
  });
});
