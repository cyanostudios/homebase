import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const MATCH_TABLE_COLUMN_IDS = [
  'matchup',
  'location',
  'start_time',
  'home_team',
  'away_team',
  'team_id',
  'competition_name',
  'created_at',
  'updated_at',
] as const;

export type MatchTableColumnId = (typeof MATCH_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: MATCH_TABLE_COLUMN_IDS,
  requiredColumnId: 'matchup',
  /**
   * Matchup is the only list column; team / venue / time render as meta under the name
   * (Contacts / Invoices pattern).
   */
  defaultHidden: [
    'location',
    'start_time',
    'home_team',
    'away_team',
    'team_id',
    'competition_name',
    'created_at',
    'updated_at',
  ],
});

export const DEFAULT_MATCH_TABLE_COLUMNS = helpers.DEFAULT;
export const isMatchTableColumnId = helpers.isColumnId;
export const normalizeMatchTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleMatchTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): MatchTableColumnId[] => helpers.resolveVisible(null);
export const matchTableColumnsEqual = helpers.equal;
export const reorderMatchTableColumns = helpers.reorder;
export const setMatchTableColumnHidden = helpers.setHidden;
export type MatchTableColumnsPref = ReturnType<typeof helpers.normalize>;
