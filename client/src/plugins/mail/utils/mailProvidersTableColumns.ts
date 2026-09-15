import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const MAIL_PROVIDERS_TABLE_COLUMN_IDS = [
  'provider',
  'status',
  'capability',
  'credentials',
] as const;

export type MailProvidersTableColumnId = (typeof MAIL_PROVIDERS_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: MAIL_PROVIDERS_TABLE_COLUMN_IDS,
  requiredColumnId: 'provider',
  /**
   * Provider is the only list column; status / capability / credentials render as meta under the name
   * (Contacts / Cups / AI Providers pattern).
   */
  defaultHidden: ['status', 'capability', 'credentials'],
});

export const DEFAULT_MAIL_PROVIDERS_TABLE_COLUMNS = helpers.DEFAULT;
export const isMailProvidersTableColumnId = helpers.isColumnId;
export const normalizeMailProvidersTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleMailProvidersTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): MailProvidersTableColumnId[] => helpers.resolveVisible(null);
export const mailProvidersTableColumnsEqual = helpers.equal;
export const reorderMailProvidersTableColumns = helpers.reorder;
export const setMailProvidersTableColumnHidden = helpers.setHidden;
export type MailProvidersTableColumnsPref = ReturnType<typeof helpers.normalize>;
