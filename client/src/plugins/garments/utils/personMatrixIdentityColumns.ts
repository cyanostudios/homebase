import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

/** Fixed person-matrix identity columns (not checkbox_columns). Name is always visible. */
export const PERSON_MATRIX_IDENTITY_COLUMN_IDS = [
  'name',
  'team',
  'jerseyName',
  'initials',
  'jerseyNumber',
] as const;

export type PersonMatrixIdentityColumnId = (typeof PERSON_MATRIX_IDENTITY_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: PERSON_MATRIX_IDENTITY_COLUMN_IDS,
  requiredColumnId: 'name',
  /** Name-only default; additional identity columns come later in code if needed. */
  defaultHidden: ['team', 'jerseyName', 'initials', 'jerseyNumber'],
});

export const DEFAULT_PERSON_MATRIX_IDENTITY_COLUMNS = helpers.DEFAULT;
export const isPersonMatrixIdentityColumnId = helpers.isColumnId;
export const normalizePersonMatrixIdentityColumns = helpers.normalize;
export const personMatrixIdentityColumnsEqual = helpers.equal;
export const reorderPersonMatrixIdentityColumns = helpers.reorder;
export const setPersonMatrixIdentityColumnHidden = helpers.setHidden;
export type PersonMatrixIdentityColumnsPref = ReturnType<typeof helpers.normalize>;

export type PersonMatrixIdentityByList = Record<string, PersonMatrixIdentityColumnsPref>;

export function normalizePersonMatrixIdentityByList(raw: unknown): PersonMatrixIdentityByList {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const result: PersonMatrixIdentityByList = {};
  for (const [listId, pref] of Object.entries(raw as Record<string, unknown>)) {
    if (!listId.trim()) {
      continue;
    }
    result[listId] = normalizePersonMatrixIdentityColumns(pref);
  }
  return result;
}

/** Always code defaults — identity column prefs were removed from settings. */
export function resolveVisiblePersonMatrixIdentityColumns(
  _settings: { personMatrixIdentityByList?: unknown } | null | undefined,
  _listId: string,
): PersonMatrixIdentityColumnId[] {
  return helpers.resolveVisible(null);
}

export function getPersonMatrixIdentityPrefForList(
  _settings: { personMatrixIdentityByList?: unknown } | null | undefined,
  _listId: string,
): PersonMatrixIdentityColumnsPref {
  return normalizePersonMatrixIdentityColumns(null);
}
