import type { Note } from '../types/notes';

export type NoteSortField = 'title' | 'createdAt' | 'updatedAt' | 'mentions';
export type NoteSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: NoteSortField[] = ['title'];
const DATE_SORT_FIELDS: NoteSortField[] = ['createdAt', 'updatedAt'];

export function isNoteStringSortField(field: NoteSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function isNoteDateSortField(field: NoteSortField): boolean {
  return DATE_SORT_FIELDS.includes(field);
}

type NoteSortable = Pick<Note, 'title' | 'createdAt' | 'updatedAt'> & {
  mentions?: Array<{ contactId?: string; contactName?: string }>;
};

export function getNoteSortValue(
  note: NoteSortable,
  field: Exclude<NoteSortField, 'mentions'>,
): string | Date | null {
  if (field === 'title') {
    return note.title.toLowerCase();
  }
  if (field === 'createdAt') {
    return note.createdAt;
  }
  return note.updatedAt;
}

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function toSortDay(value: Date | string): number {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: NoteSortOrder,
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

export function compareNotesByField(
  a: NoteSortable,
  b: NoteSortable,
  field: NoteSortField,
  order: NoteSortOrder,
): number {
  if (field === 'mentions') {
    const aCount = a.mentions?.length ?? 0;
    const bCount = b.mentions?.length ?? 0;
    return order === 'asc' ? aCount - bCount : bCount - aCount;
  }

  const aValue = getNoteSortValue(a, field);
  const bValue = getNoteSortValue(b, field);

  if (isNoteStringSortField(field)) {
    if (order === 'asc') {
      return (aValue as string).localeCompare(bValue as string);
    }
    return (bValue as string).localeCompare(aValue as string);
  }

  return compareNullableTimes(aValue as Date | null, bValue as Date | null, order, toSortTime);
}

export function compareNotesTwoLevel(
  a: NoteSortable,
  b: NoteSortable,
  primary: NoteSortField,
  secondary: NoteSortField | '',
  order: NoteSortOrder,
): number {
  if (secondary && (primary === 'updatedAt' || primary === 'createdAt')) {
    const aPrimary = getNoteSortValue(a, primary);
    const bPrimary = getNoteSortValue(b, primary);
    const dayResult = compareNullableTimes(aPrimary, bPrimary, order, toSortDay);
    if (dayResult !== 0) {
      return dayResult;
    }
    const secondaryResult = compareNotesByField(a, b, secondary, order);
    if (secondaryResult !== 0) {
      return secondaryResult;
    }
    return compareNullableTimes(aPrimary, bPrimary, order, toSortTime);
  }

  const primaryResult = compareNotesByField(a, b, primary, order);
  if (primaryResult !== 0) {
    return primaryResult;
  }
  if (secondary) {
    return compareNotesByField(a, b, secondary, order);
  }
  return 0;
}
