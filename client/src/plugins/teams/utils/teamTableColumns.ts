import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const TEAM_TABLE_COLUMN_IDS = [
  'age_group',
  'name',
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
  requiredColumnId: 'age_group',
  defaultHidden: ['playing_format', 'created_at', 'updated_at'],
});

export const DEFAULT_TEAM_TABLE_COLUMNS = helpers.DEFAULT;
export const isTeamTableColumnId = helpers.isColumnId;
export const normalizeTeamTableColumns = helpers.normalize;
export const resolveVisibleTeamTableColumns = helpers.resolveVisible;
export const teamTableColumnsEqual = helpers.equal;
export const reorderTeamTableColumns = helpers.reorder;
export const setTeamTableColumnHidden = helpers.setHidden;
export type TeamTableColumnsPref = ReturnType<typeof helpers.normalize>;
