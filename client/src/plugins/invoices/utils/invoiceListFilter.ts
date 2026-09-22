import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { InvoiceStatus } from '../types/invoices';

import { INVOICE_NUMBERING_TYPES, type InvoiceNumberingType } from './invoiceNumbering';

/** Status chips (including synthetic `unpaid`). */
export type InvoiceStatusListFilter =
  | 'draft'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'canceled'
  | 'unpaid';

/** Document-type chips. */
export type InvoiceTypeListFilter = InvoiceNumberingType;

/** Selectable filters (excluding "all", which clears the selection). */
export type InvoiceListFilter = InvoiceStatusListFilter | InvoiceTypeListFilter;

/** Empty array = show all. Multiple filters are AND-combined across groups. */
export type InvoiceListFilterSelection = InvoiceListFilter[];

export const INVOICE_STATUS_LIST_FILTERS = [
  'draft',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'canceled',
  'unpaid',
] as const satisfies readonly InvoiceStatusListFilter[];

export const INVOICE_TYPE_LIST_FILTERS = INVOICE_NUMBERING_TYPES;

export const INVOICE_LIST_FILTER_EXCLUSIVE_GROUPS = [
  INVOICE_STATUS_LIST_FILTERS,
  INVOICE_TYPE_LIST_FILTERS,
] as const;

export function getInvoiceAmountPaid(item: {
  amountPaid?: number | null;
  status?: InvoiceStatus | string | null;
}): number {
  if (item.amountPaid != null && Number.isFinite(Number(item.amountPaid))) {
    return Number(item.amountPaid);
  }
  return item.status === 'paid' ? Number.POSITIVE_INFINITY : 0;
}

function resolveInvoiceType(
  invoiceType?: InvoiceNumberingType | string | null,
): InvoiceNumberingType {
  const raw = String(invoiceType || 'invoice').trim();
  return (INVOICE_TYPE_LIST_FILTERS as readonly string[]).includes(raw)
    ? (raw as InvoiceNumberingType)
    : 'invoice';
}

function isTypeFilter(filter: InvoiceListFilter): filter is InvoiceTypeListFilter {
  return (INVOICE_TYPE_LIST_FILTERS as readonly string[]).includes(filter);
}

export function invoiceMatchesSingleFilter(
  item: {
    status?: InvoiceStatus | string | null;
    amountPaid?: number | null;
    total?: number | null;
    invoiceType?: InvoiceNumberingType | string | null;
  },
  filter: InvoiceListFilter,
): boolean {
  if (isTypeFilter(filter)) {
    return resolveInvoiceType(item.invoiceType) === filter;
  }
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
    invoiceType?: InvoiceNumberingType | string | null;
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
