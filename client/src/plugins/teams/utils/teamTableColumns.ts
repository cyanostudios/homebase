import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const TEAM_TABLE_COLUMN_IDS = [
  'name',
  'age_group',
  'gender',
  'status',
  'series_teams',
  'player_count',
  'playing_format',
  'created_at',
  'updated_at',
] as const;

export type TeamTableColumnId = (typeof TEAM_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: TEAM_TABLE_COLUMN_IDS,
  requiredColumnId: 'name',
  /** Name-only list default; per-plugin metadata columns come later in code. */
  defaultHidden: [
    'age_group',
    'gender',
    'status',
    'series_teams',
    'player_count',
    'playing_format',
    'created_at',
    'updated_at',
  ],
});

export const DEFAULT_TEAM_TABLE_COLUMNS = helpers.DEFAULT;
export const isTeamTableColumnId = helpers.isColumnId;
export const normalizeTeamTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleTeamTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): TeamTableColumnId[] => helpers.resolveVisible(null);
export const teamTableColumnsEqual = helpers.equal;
export const reorderTeamTableColumns = helpers.reorder;
export const setTeamTableColumnHidden = helpers.setHidden;
export type TeamTableColumnsPref = ReturnType<typeof helpers.normalize>;
