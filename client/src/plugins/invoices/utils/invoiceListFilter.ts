import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { InvoiceStatus } from '../types/invoices';

/** Selectable filters (excluding "all", which clears the selection). */
export type InvoiceListFilter = 'draft' | 'paid' | 'overdue';

/** Empty array = show all. Multiple filters are AND-combined. */
export type InvoiceListFilterSelection = InvoiceListFilter[];

const STATUS_FILTERS = ['draft', 'paid', 'overdue'] as const satisfies readonly InvoiceListFilter[];

export const INVOICE_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function invoiceMatchesSingleFilter(
  item: { status?: InvoiceStatus | string | null },
  filter: InvoiceListFilter,
): boolean {
  return item.status === filter;
}

/** AND across selected filters. Empty selection = all invoices. */
export function invoiceMatchesListFilters(
  item: { status?: InvoiceStatus | string | null },
  filters: InvoiceListFilterSelection,
): boolean {
  return itemMatchesListFilters(item, filters, invoiceMatchesSingleFilter);
}

export function toggleInvoiceListFilter(
  current: InvoiceListFilterSelection,
  filter: InvoiceListFilter,
): InvoiceListFilterSelection {
  return toggleListFilterSelection(current, filter, INVOICE_LIST_FILTER_EXCLUSIVE_GROUPS);
}
