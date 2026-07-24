import type { IngestSource } from '../types/ingest';

export type IngestSortField =
  | 'name'
  | 'sourceType'
  | 'isActive'
  | 'lastFetchStatus'
  | 'lastFetchedAt'
  | 'updatedAt';
export type IngestSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: IngestSortField[] = ['name', 'sourceType', 'isActive', 'lastFetchStatus'];
const DATE_SORT_FIELDS: IngestSortField[] = ['lastFetchedAt', 'updatedAt'];

export function isIngestStringSortField(field: IngestSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isIngestDateSortField(field: IngestSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

/** Default sort direction: asc for string fields, desc for dates. */
export function isIngestAscDefaultField(field: IngestSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

type IngestSortable = Pick<
  IngestSource,
  'name' | 'sourceType' | 'isActive' | 'lastFetchStatus' | 'lastFetchedAt' | 'updatedAt'
>;

export function getIngestSortValue(
  source: IngestSortable,
  field: IngestSortField,
): string | Date | null {
  if (field === 'name') {
    return source.name.toLowerCase();
  }
  if (field === 'sourceType') {
    return source.sourceType;
  }
  if (field === 'isActive') {
    return source.isActive ? '1' : '0';
  }
  if (field === 'lastFetchStatus') {
    return source.lastFetchStatus;
  }
  if (field === 'lastFetchedAt') {
    return source.lastFetchedAt ? new Date(source.lastFetchedAt) : null;
  }
  return source.updatedAt ? new Date(source.updatedAt) : null;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** Calendar day in local time — used so secondary sort can break same-day ties. */
function toSortDay(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: IngestSortOrder,
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

export function compareIngestByField(
  a: IngestSortable,
  b: IngestSortable,
  field: IngestSortField,
  order: IngestSortOrder,
): number {
  const aValue = getIngestSortValue(a, field);
  const bValue = getIngestSortValue(b, field);

  if (isIngestStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}

/**
 * Primary then optional secondary; shared order for both levels.
 * When primary is a date field and secondary is set, primary is compared by
 * calendar day first so secondary can reorder items updated/fetched the same day.
 */
export function compareIngestTwoLevel(
  a: IngestSortable,
  b: IngestSortable,
  primary: IngestSortField,
  secondary: IngestSortField | '',
  order: IngestSortOrder,
): number {
  if (secondary && isIngestDateSortField(primary)) {
    const aPrimary = getIngestSortValue(a, primary) as Date | null;
    const bPrimary = getIngestSortValue(b, primary) as Date | null;
    const dayResult = compareNullableTimes(aPrimary, bPrimary, order, toSortDay);
    if (dayResult !== 0) {
      return dayResult;
    }
    const secondaryResult = compareIngestByField(a, b, secondary, order);
    if (secondaryResult !== 0) {
      return secondaryResult;
    }
    return compareNullableTimes(aPrimary, bPrimary, order, toSortTime);
  }

  const primaryResult = compareIngestByField(a, b, primary, order);
  if (primaryResult !== 0) {
    return primaryResult;
  }
  if (secondary) {
    return compareIngestByField(a, b, secondary, order);
  }
  return 0;
}
