import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const CUP_TABLE_COLUMN_IDS = [
  'name',
  'ingest',
  'start_date',
  'location',
  'featured',
  'ratings_count',
  'created_at',
  'updated_at',
] as const;

export type CupTableColumnId = (typeof CUP_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: CUP_TABLE_COLUMN_IDS,
  requiredColumnId: 'name',
  defaultHidden: ['created_at', 'updated_at'],
});

export const DEFAULT_CUP_TABLE_COLUMNS = helpers.DEFAULT;
export const isCupTableColumnId = helpers.isColumnId;
export const normalizeCupTableColumns = helpers.normalize;
export const resolveVisibleCupTableColumns = helpers.resolveVisible;
export const cupTableColumnsEqual = helpers.equal;
export const reorderCupTableColumns = helpers.reorder;
export const setCupTableColumnHidden = helpers.setHidden;
export type CupTableColumnsPref = ReturnType<typeof helpers.normalize>;
