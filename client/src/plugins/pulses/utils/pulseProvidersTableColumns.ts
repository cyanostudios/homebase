import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const PULSE_PROVIDERS_TABLE_COLUMN_IDS = [
  'provider',
  'status',
  'capability',
  'credentials',
] as const;

export type PulseProvidersTableColumnId = (typeof PULSE_PROVIDERS_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: PULSE_PROVIDERS_TABLE_COLUMN_IDS,
  requiredColumnId: 'provider',
  /**
   * Provider is the only list column; status / capability / credentials render as meta under the name
   * (Contacts / Cups / AI Providers pattern).
   */
  defaultHidden: ['status', 'capability', 'credentials'],
});

export const DEFAULT_PULSE_PROVIDERS_TABLE_COLUMNS = helpers.DEFAULT;
export const isPulseProvidersTableColumnId = helpers.isColumnId;
export const normalizePulseProvidersTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisiblePulseProvidersTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): PulseProvidersTableColumnId[] => helpers.resolveVisible(null);
export const pulseProvidersTableColumnsEqual = helpers.equal;
export const reorderPulseProvidersTableColumns = helpers.reorder;
export const setPulseProvidersTableColumnHidden = helpers.setHidden;
export type PulseProvidersTableColumnsPref = ReturnType<typeof helpers.normalize>;
