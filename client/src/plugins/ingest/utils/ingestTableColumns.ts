import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const INGEST_TABLE_COLUMN_IDS = [
  'name',
  'sourceType',
  'isActive',
  'lastFetchStatus',
  'lastFetchedAt',
] as const;

export type IngestTableColumnId = (typeof INGEST_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: INGEST_TABLE_COLUMN_IDS,
  requiredColumnId: 'name',
  /**
   * Name is the only list column; type / active / status / last fetch render as meta under the name
   * (Contacts / Cups / Tasks pattern).
   */
  defaultHidden: ['sourceType', 'isActive', 'lastFetchStatus', 'lastFetchedAt'],
});

export const DEFAULT_INGEST_TABLE_COLUMNS = helpers.DEFAULT;
export const isIngestTableColumnId = helpers.isColumnId;
export const normalizeIngestTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleIngestTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): IngestTableColumnId[] => helpers.resolveVisible(null);
export const ingestTableColumnsEqual = helpers.equal;
export const reorderIngestTableColumns = helpers.reorder;
export const setIngestTableColumnHidden = helpers.setHidden;
export type IngestTableColumnsPref = ReturnType<typeof helpers.normalize>;
