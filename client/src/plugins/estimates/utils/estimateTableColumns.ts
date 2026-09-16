import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const ESTIMATE_TABLE_COLUMN_IDS = [
  'estimateNumber',
  'contactName',
  'status',
  'total',
  'validTo',
  'createdAt',
  'updatedAt',
] as const;

export type EstimateTableColumnId = (typeof ESTIMATE_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: ESTIMATE_TABLE_COLUMN_IDS,
  requiredColumnId: 'estimateNumber',
  /** Only estimate number column; contact + total render as meta (Invoices pattern). */
  defaultHidden: ['contactName', 'status', 'total', 'validTo', 'createdAt', 'updatedAt'],
});

export const DEFAULT_ESTIMATE_TABLE_COLUMNS = helpers.DEFAULT;
export const isEstimateTableColumnId = helpers.isColumnId;
export const normalizeEstimateTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleEstimateTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): EstimateTableColumnId[] => helpers.resolveVisible(null);
export const estimateTableColumnsEqual = helpers.equal;
export const reorderEstimateTableColumns = helpers.reorder;
export const setEstimateTableColumnHidden = helpers.setHidden;
export type EstimateTableColumnsPref = ReturnType<typeof helpers.normalize>;
