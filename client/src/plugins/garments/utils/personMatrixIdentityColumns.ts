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
  /** All identity columns visible by default (including team / jersey / initials / number). */
  defaultHidden: [],
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

export function resolveVisiblePersonMatrixIdentityColumns(
  settings: { personMatrixIdentityByList?: unknown } | null | undefined,
  listId: string,
): PersonMatrixIdentityColumnId[] {
  const byList = normalizePersonMatrixIdentityByList(settings?.personMatrixIdentityByList);
  const pref = normalizePersonMatrixIdentityColumns(byList[listId]);
  return pref.order.filter((id) => !pref.hidden.includes(id));
}

export function getPersonMatrixIdentityPrefForList(
  settings: { personMatrixIdentityByList?: unknown } | null | undefined,
  listId: string,
): PersonMatrixIdentityColumnsPref {
  const byList = normalizePersonMatrixIdentityByList(settings?.personMatrixIdentityByList);
  return normalizePersonMatrixIdentityColumns(byList[listId]);
}
