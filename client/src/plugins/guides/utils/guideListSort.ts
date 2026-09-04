import type { Guide } from '../types/guides';

export type GuideSortField =
  | 'id'
  | 'displayName'
  | 'updatedAt'
  | 'createdAt'
  | 'lifecycleStatus'
  | 'languages';
export type GuideSortOrder = 'asc' | 'desc';

const DATE_SORT_FIELDS: GuideSortField[] = ['updatedAt', 'createdAt'];

export function isGuideDateSortField(field: GuideSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

/** Default asc for displayName, id, lifecycle; desc for dates and languages count (highest first). */
export function isGuideAscDefaultField(field: GuideSortField): boolean {
  return field === 'displayName' || field === 'id' || field === 'lifecycleStatus';
}

type GuideSortable = Pick<
  Guide,
  'id' | 'displayName' | 'updatedAt' | 'createdAt' | 'lifecycleStatus' | 'languages'
>;

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: GuideSortOrder,
  toTime: (value: Date | string) => number,
): number {
  if (!aValue && !bValue) {
    return 0;
  }
  if (!aValue) {
    return order === 'asc' ? 1 : -1;
  }
  if (!bValue) {
    return order === 'asc' ? -1 : 1;
  }
  const aTime = toTime(aValue);
  const bTime = toTime(bValue);
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

export function compareGuidesByField(
  a: GuideSortable,
  b: GuideSortable,
  field: GuideSortField,
  order: GuideSortOrder,
): number {
  if (field === 'updatedAt' || field === 'createdAt') {
    return compareNullableTimes(a[field], b[field], order, toSortTime);
  }
  if (field === 'id') {
    const av = Number(a.id) || 0;
    const bv = Number(b.id) || 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  if (field === 'languages') {
    const av = a.languages?.length ?? 0;
    const bv = b.languages?.length ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  if (field === 'lifecycleStatus') {
    const res = a.lifecycleStatus.localeCompare(b.lifecycleStatus);
    return order === 'asc' ? res : -res;
  }
  const res = a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase(), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  return order === 'asc' ? res : -res;
}
