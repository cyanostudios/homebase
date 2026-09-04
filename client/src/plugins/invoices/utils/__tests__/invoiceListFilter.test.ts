import {
  invoiceMatchesListFilters,
  invoiceMatchesSingleFilter,
  toggleInvoiceListFilter,
} from '../invoiceListFilter';
import { computeInvoiceStats } from '../invoiceStats';

describe('invoiceMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(invoiceMatchesListFilters({ status: 'paid' }, [])).toBe(true);
  });

  it('matches exclusive statuses', () => {
    expect(invoiceMatchesListFilters({ status: 'draft' }, ['draft'])).toBe(true);
    expect(invoiceMatchesListFilters({ status: 'overdue' }, ['paid'])).toBe(false);
    expect(invoiceMatchesListFilters({ status: 'sent' }, ['sent'])).toBe(true);
    expect(invoiceMatchesListFilters({ status: 'partially_paid' }, ['partially_paid'])).toBe(true);
  });

  it('matches unpaid facet', () => {
    expect(
      invoiceMatchesSingleFilter({ status: 'sent', amountPaid: 0, total: 100 }, 'unpaid'),
    ).toBe(true);
    expect(
      invoiceMatchesSingleFilter(
        { status: 'partially_paid', amountPaid: 40, total: 100 },
        'unpaid',
      ),
    ).toBe(false);
  });
});

describe('toggleInvoiceListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(toggleInvoiceListFilter(['draft'], 'paid')).toEqual(['paid']);
    expect(toggleInvoiceListFilter(['paid'], 'overdue')).toEqual(['overdue']);
    expect(toggleInvoiceListFilter(['overdue'], 'overdue')).toEqual([]);
    expect(toggleInvoiceListFilter(['sent'], 'partially_paid')).toEqual(['partially_paid']);
  });

  it('keeps unpaid independent of status', () => {
    expect(toggleInvoiceListFilter(['sent'], 'unpaid')).toEqual(['sent', 'unpaid']);
  });
});

describe('computeInvoiceStats', () => {
  it('aggregates outstanding overdue paid and partially paid', () => {
    const stats = computeInvoiceStats([
      { id: '1', status: 'sent', total: 100, amountPaid: 0 },
      { id: '2', status: 'overdue', total: 50, amountPaid: 10 },
      { id: '3', status: 'paid', total: 200, amountPaid: 200 },
      { id: '4', status: 'draft', total: 30, amountPaid: 0 },
      { id: '5', status: 'partially_paid', total: 80, amountPaid: 20 },
    ] as any);

    expect(stats.sent.count).toBe(1);
    expect(stats.overdue.count).toBe(1);
    expect(stats.paid.count).toBe(1);
    expect(stats.draft.count).toBe(1);
    expect(stats.partiallyPaid.count).toBe(1);
    expect(stats.outstanding.totalAmount).toBe(200);
    expect(stats.partialPayments).toBe(2);
    expect(stats.totalCollected).toBe(230);
    expect(stats.invoiceCount).toBe(5);
  });
});
