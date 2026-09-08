import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import { INVOICE_NUMBERING_TYPES, type InvoiceNumberingType } from './invoiceNumbering';

/** Selectable filters = document types (excluding "all", which clears the selection). */
export type InvoiceListFilter = InvoiceNumberingType;

/** Empty array = show all. Multiple filters are AND-combined. */
export type InvoiceListFilterSelection = InvoiceListFilter[];

export const INVOICE_LIST_FILTERS = INVOICE_NUMBERING_TYPES;

export const INVOICE_LIST_FILTER_EXCLUSIVE_GROUPS = [INVOICE_LIST_FILTERS] as const;

function resolveInvoiceType(
  invoiceType?: InvoiceNumberingType | string | null,
): InvoiceNumberingType {
  const raw = String(invoiceType || 'invoice').trim();
  return (INVOICE_LIST_FILTERS as readonly string[]).includes(raw)
    ? (raw as InvoiceNumberingType)
    : 'invoice';
}

export function invoiceMatchesSingleFilter(
  item: {
    invoiceType?: InvoiceNumberingType | string | null;
  },
  filter: InvoiceListFilter,
): boolean {
  return resolveInvoiceType(item.invoiceType) === filter;
}

/** AND across selected filters. Empty selection = all invoices. */
export function invoiceMatchesListFilters(
  item: {
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
