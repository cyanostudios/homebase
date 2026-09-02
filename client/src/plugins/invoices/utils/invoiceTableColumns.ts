import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const INVOICE_TABLE_COLUMN_IDS = [
  'invoiceNumber',
  'contactName',
  'status',
  'total',
  'dueDate',
  'createdAt',
  'updatedAt',
] as const;

export type InvoiceTableColumnId = (typeof INVOICE_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: INVOICE_TABLE_COLUMN_IDS,
  requiredColumnId: 'invoiceNumber',
  defaultHidden: ['createdAt', 'updatedAt'],
});

export const DEFAULT_INVOICE_TABLE_COLUMNS = helpers.DEFAULT;
export const isInvoiceTableColumnId = helpers.isColumnId;
export const normalizeInvoiceTableColumns = helpers.normalize;
export const resolveVisibleInvoiceTableColumns = helpers.resolveVisible;
export const invoiceTableColumnsEqual = helpers.equal;
export const reorderInvoiceTableColumns = helpers.reorder;
export const setInvoiceTableColumnHidden = helpers.setHidden;
export type InvoiceTableColumnsPref = ReturnType<typeof helpers.normalize>;
