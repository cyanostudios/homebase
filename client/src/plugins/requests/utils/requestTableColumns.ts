import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const REQUEST_TABLE_COLUMN_IDS = [
  'title',
  'status',
  'priority',
  'type',
  'responseDueAt',
  'source',
  'created_at',
  'updated_at',
] as const;

export type RequestTableColumnId = (typeof REQUEST_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: REQUEST_TABLE_COLUMN_IDS,
  requiredColumnId: 'title',
  defaultHidden: ['source', 'created_at', 'updated_at'],
});

export const DEFAULT_REQUEST_TABLE_COLUMNS = helpers.DEFAULT;
export const isRequestTableColumnId = helpers.isColumnId;
export const normalizeRequestTableColumns = helpers.normalize;
export const resolveVisibleRequestTableColumns = helpers.resolveVisible;
export const requestTableColumnsEqual = helpers.equal;
export const reorderRequestTableColumns = helpers.reorder;
export const setRequestTableColumnHidden = helpers.setHidden;
export type RequestTableColumnsPref = ReturnType<typeof helpers.normalize>;

/** Settings category key for requests plugin (also used for requestTypes). */
export const REQUESTS_SETTINGS_KEY = 'requests';
