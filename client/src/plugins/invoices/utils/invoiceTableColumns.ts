import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const INVOICE_TABLE_COLUMN_IDS = [
  'invoiceNumber',
  'invoiceType',
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
  /** Name-only list default; per-plugin metadata columns come later in code. */
  defaultHidden: [
    'invoiceType',
    'contactName',
    'status',
    'total',
    'dueDate',
    'createdAt',
    'updatedAt',
  ],
});

export const DEFAULT_INVOICE_TABLE_COLUMNS = helpers.DEFAULT;
export const isInvoiceTableColumnId = helpers.isColumnId;
export const normalizeInvoiceTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleInvoiceTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): InvoiceTableColumnId[] => helpers.resolveVisible(null);
export const invoiceTableColumnsEqual = helpers.equal;
export const reorderInvoiceTableColumns = helpers.reorder;
export const setInvoiceTableColumnHidden = helpers.setHidden;
export type InvoiceTableColumnsPref = ReturnType<typeof helpers.normalize>;
