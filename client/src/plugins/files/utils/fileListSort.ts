import type { FileItem } from '../types/files';

export type FileSortField = 'name' | 'mimeType' | 'size' | 'updatedAt' | 'createdAt' | 'id';
export type FileSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: FileSortField[] = ['name', 'mimeType', 'id'];
const DATE_SORT_FIELDS: FileSortField[] = ['updatedAt', 'createdAt'];
const NUMERIC_SORT_FIELDS: FileSortField[] = ['size'];

export function isFileStringSortField(field: FileSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isFileDateSortField(field: FileSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

export function isFileNumericSortField(field: FileSortField): boolean {
  return NUMERIC_SORT_FIELDS.includes(field);
}

export function getFileSortValue(
  file: Pick<FileItem, 'name' | 'mimeType' | 'size' | 'updatedAt' | 'createdAt' | 'id'>,
  field: FileSortField,
): string | number | Date | null {
  if (field === 'name') {
    return (file.name ?? '').toLowerCase();
  }
  if (field === 'mimeType') {
    return (file.mimeType ?? '').toLowerCase();
  }
  if (field === 'id') {
    return (file.id ?? '').toLowerCase();
  }
  if (field === 'size') {
    return typeof file.size === 'number' ? file.size : null;
  }
  if (field === 'updatedAt') {
    if (!file.updatedAt) return null;
    return file.updatedAt instanceof Date ? file.updatedAt : new Date(file.updatedAt);
  }
  // createdAt
  if (!file.createdAt) return null;
  return file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt);
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
  order: FileSortOrder,
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

function compareNullableNumbers(
  aValue: number | null | undefined,
  bValue: number | null | undefined,
  order: FileSortOrder,
): number {
  if ((aValue === null || aValue === undefined) && (bValue === null || bValue === undefined)) {
    return 0;
  }
  if (aValue === null || aValue === undefined) {
    return order === 'asc' ? 1 : -1;
  }
  if (bValue === null || bValue === undefined) {
    return order === 'asc' ? -1 : 1;
  }
  return order === 'asc' ? aValue - bValue : bValue - aValue;
}

export function compareFilesByField(
  a: Pick<FileItem, 'name' | 'mimeType' | 'size' | 'updatedAt' | 'createdAt' | 'id'>,
  b: Pick<FileItem, 'name' | 'mimeType' | 'size' | 'updatedAt' | 'createdAt' | 'id'>,
  field: FileSortField,
  order: FileSortOrder,
): number {
  const aValue = getFileSortValue(a, field);
  const bValue = getFileSortValue(b, field);

  if (isFileStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  if (isFileNumericSortField(field)) {
    return compareNullableNumbers(aValue as number | null, bValue as number | null, order);
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}

/**
 * Primary then optional secondary; shared order for both levels.
 * When primary is a date field and secondary is set, primary is compared by
 * calendar day first so secondary can reorder items updated/created the same day.
 */
export function compareFilesTwoLevel(
  a: Pick<FileItem, 'name' | 'mimeType' | 'size' | 'updatedAt' | 'createdAt' | 'id'>,
  b: Pick<FileItem, 'name' | 'mimeType' | 'size' | 'updatedAt' | 'createdAt' | 'id'>,
  primary: FileSortField,
  secondary: FileSortField | '',
  order: FileSortOrder,
): number {
  if (secondary && isFileDateSortField(primary)) {
    const aPrimary = getFileSortValue(a, primary) as Date | null;
    const bPrimary = getFileSortValue(b, primary) as Date | null;
    const dayResult = compareNullableTimes(aPrimary, bPrimary, order, toSortDay);
    if (dayResult !== 0) {
      return dayResult;
    }
    const secondaryResult = compareFilesByField(a, b, secondary, order);
    if (secondaryResult !== 0) {
      return secondaryResult;
    }
    return compareNullableTimes(aPrimary, bPrimary, order, toSortTime);
  }

  const primaryResult = compareFilesByField(a, b, primary, order);
  if (primaryResult !== 0) {
    return primaryResult;
  }
  if (secondary) {
    return compareFilesByField(a, b, secondary, order);
  }
  return 0;
}
