import type { ExportFormatConfig } from '@/core/utils/exportUtils';

import type { Invoice } from '../context/InvoicesContext';

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return '';
  }
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) {
      return '';
    }
    return d.toLocaleDateString('sv-SE');
  } catch {
    return '';
  }
}

export function invoiceToCsvRow(invoice: Invoice): Record<string, unknown> {
  return {
    invoiceNumber: invoice.invoiceNumber ?? '',
    contactName: invoice.contactName ?? '',
    currency: invoice.currency ?? '',
    total: invoice.total ?? 0,
    status: invoice.status ?? '',
    issueDate: invoice.issueDate
      ? invoice.issueDate instanceof Date
        ? invoice.issueDate.toISOString()
        : String(invoice.issueDate)
      : '',
    dueDate: invoice.dueDate
      ? invoice.dueDate instanceof Date
        ? invoice.dueDate.toISOString()
        : String(invoice.dueDate)
      : '',
    createdAt: invoice.createdAt
      ? invoice.createdAt instanceof Date
        ? invoice.createdAt.toISOString()
        : String(invoice.createdAt)
      : '',
  };
}

export function invoiceToPdfRow(invoice: Invoice): Record<string, unknown> {
  return {
    invoiceNumber: invoice.invoiceNumber ?? '',
    contactName: invoice.contactName ?? '',
    currency: invoice.currency ?? '',
    total: invoice.total ?? 0,
    status: invoice.status ?? '',
    issueDate: formatDate(invoice.issueDate),
    dueDate: formatDate(invoice.dueDate),
    createdAt: formatDate(invoice.createdAt),
  };
}

export function getInvoiceExportBaseFilename(invoice: Invoice): string {
  const name = (invoice.invoiceNumber || invoice.id || 'invoice').replace(/[^a-z0-9]/gi, '_');
  return name.toLowerCase();
}

export const invoiceExportConfig: ExportFormatConfig = {
  csv: {
    headers: [
      'invoiceNumber',
      'contactName',
      'currency',
      'total',
      'status',
      'issueDate',
      'dueDate',
      'createdAt',
    ],
    mapItemToRow: invoiceToCsvRow,
  },
  pdf: {
    columns: [
      { key: 'invoiceNumber', label: 'Invoice #' },
      { key: 'contactName', label: 'Contact' },
      { key: 'currency', label: 'Currency' },
      { key: 'total', label: 'Total' },
      { key: 'status', label: 'Status' },
      { key: 'issueDate', label: 'Issue Date' },
      { key: 'dueDate', label: 'Due Date' },
      { key: 'createdAt', label: 'Created' },
    ],
    mapItemToRow: invoiceToPdfRow,
    title: 'Invoices Export',
  },
};
