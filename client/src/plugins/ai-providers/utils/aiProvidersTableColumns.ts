import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const AI_PROVIDERS_TABLE_COLUMN_IDS = [
  'provider',
  'status',
  'defaultModel',
  'apiKey',
] as const;

export type AIProvidersTableColumnId = (typeof AI_PROVIDERS_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: AI_PROVIDERS_TABLE_COLUMN_IDS,
  requiredColumnId: 'provider',
  /**
   * Provider is the only list column; status / model / API key render as meta under the name
   * (Contacts / Cups / Ingest pattern).
   */
  defaultHidden: ['status', 'defaultModel', 'apiKey'],
});

export const DEFAULT_AI_PROVIDERS_TABLE_COLUMNS = helpers.DEFAULT;
export const isAIProvidersTableColumnId = helpers.isColumnId;
export const normalizeAIProvidersTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleAIProvidersTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): AIProvidersTableColumnId[] => helpers.resolveVisible(null);
export const aiProvidersTableColumnsEqual = helpers.equal;
export const reorderAIProvidersTableColumns = helpers.reorder;
export const setAIProvidersTableColumnHidden = helpers.setHidden;
export type AIProvidersTableColumnsPref = ReturnType<typeof helpers.normalize>;
