import type { Invoice } from '../types/invoices';
import { resolveInvoiceTotals } from './invoiceTotals';

export type InvoiceSortField =
  | 'invoiceNumber'
  | 'contactName'
  | 'status'
  | 'total'
  | 'createdAt'
  | 'updatedAt'
  | 'dueDate'
  | 'issueDate';

export type InvoiceSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: InvoiceSortField[] = ['invoiceNumber', 'contactName', 'status'];
const NUMBER_SORT_FIELDS: InvoiceSortField[] = ['total'];
const DATE_SORT_FIELDS: InvoiceSortField[] = ['createdAt', 'updatedAt', 'dueDate', 'issueDate'];

export function isInvoiceStringSortField(field: InvoiceSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isInvoiceNumberSortField(field: InvoiceSortField): boolean {
  return NUMBER_SORT_FIELDS.includes(field);
}

export function isInvoiceDateSortField(field: InvoiceSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

type InvoiceSortPick = Pick<
  Invoice,
  'invoiceNumber' | 'contactName' | 'status' | 'createdAt' | 'updatedAt' | 'dueDate' | 'issueDate'
> & { total?: number };

export function getInvoiceSortValue(
  invoice: InvoiceSortPick,
  field: InvoiceSortField,
): string | number | Date | null {
  if (field === 'invoiceNumber') {
    return (invoice.invoiceNumber || '').toLowerCase();
  }
  if (field === 'contactName') {
    return (invoice.contactName || '').toLowerCase();
  }
  if (field === 'status') {
    return invoice.status || 'draft';
  }
  if (field === 'total') {
    return resolveInvoiceTotals(invoice as Invoice).total;
  }
  if (field === 'createdAt') {
    return invoice.createdAt ?? null;
  }
  if (field === 'updatedAt') {
    return invoice.updatedAt ?? null;
  }
  if (field === 'issueDate') {
    return invoice.issueDate ?? null;
  }
  return invoice.dueDate ?? null;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: InvoiceSortOrder,
  toTime: (value: Date | string) => number,
): number {
  if (!aValue && !bValue) {
    return 0;
  }
  if (!aValue) {
    return order === 'asc' ? 1 : -1;
  }
  if (!bValue) {
    return order === 'asc' ? -1 : 1;
  }
  const aTime = toTime(aValue);
  const bTime = toTime(bValue);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

export function compareInvoicesByField(
  a: InvoiceSortPick,
  b: InvoiceSortPick,
  field: InvoiceSortField,
  order: InvoiceSortOrder,
): number {
  const aValue = getInvoiceSortValue(a, field);
  const bValue = getInvoiceSortValue(b, field);

  if (isInvoiceStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  if (isInvoiceNumberSortField(field)) {
    const aNum = aValue as number;
    const bNum = bValue as number;
    return order === 'asc' ? aNum - bNum : bNum - aNum;
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}
