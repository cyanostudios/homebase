import { invoiceMatchesListFilters, toggleInvoiceListFilter } from '../invoiceListFilter';

describe('invoiceMatchesListFilters', () => {
  it('allows all when selection is empty', () => {
    expect(invoiceMatchesListFilters({ status: 'paid' }, [])).toBe(true);
  });

  it('matches exclusive statuses', () => {
    expect(invoiceMatchesListFilters({ status: 'draft' }, ['draft'])).toBe(true);
    expect(invoiceMatchesListFilters({ status: 'overdue' }, ['paid'])).toBe(false);
  });
});

describe('toggleInvoiceListFilter', () => {
  it('replaces within exclusive status group', () => {
    expect(toggleInvoiceListFilter(['draft'], 'paid')).toEqual(['paid']);
    expect(toggleInvoiceListFilter(['paid'], 'overdue')).toEqual(['overdue']);
    expect(toggleInvoiceListFilter(['overdue'], 'overdue')).toEqual([]);
  });
});
