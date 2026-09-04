import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { InvoiceStatus } from '../types/invoices';

/** Selectable filters (excluding "all", which clears the selection). */
export type InvoiceListFilter =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'canceled'
  | 'unpaid';

/** Empty array = show all. Multiple filters are AND-combined. */
export type InvoiceListFilterSelection = InvoiceListFilter[];

const STATUS_FILTERS = [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'canceled',
] as const satisfies readonly InvoiceListFilter[];

export const INVOICE_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function getInvoiceAmountPaid(item: {
  amountPaid?: number | null;
  status?: InvoiceStatus | string | null;
}): number {
  if (item.amountPaid != null && Number.isFinite(Number(item.amountPaid))) {
    return Number(item.amountPaid);
  }
  return item.status === 'paid' ? Number.POSITIVE_INFINITY : 0;
}

export function invoiceMatchesSingleFilter(
  item: {
    status?: InvoiceStatus | string | null;
    amountPaid?: number | null;
    total?: number | null;
  },
  filter: InvoiceListFilter,
): boolean {
  if (filter === 'unpaid') {
    const paid = getInvoiceAmountPaid(item);
    const total = Number(item.total || 0);
    if (
      item.status === 'paid' ||
      item.status === 'canceled' ||
      item.status === 'draft' ||
      item.status === 'partially_paid'
    ) {
      return false;
    }
    return paid <= 0 && total > 0;
  }
  return item.status === filter;
}

/** AND across selected filters. Empty selection = all invoices. */
export function invoiceMatchesListFilters(
  item: {
    status?: InvoiceStatus | string | null;
    amountPaid?: number | null;
    total?: number | null;
  },
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
