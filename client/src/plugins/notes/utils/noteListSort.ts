import { nextListTableSort } from '@/core/list/listViewMode';

import type { Note } from '../types/notes';

export type NoteSortField = 'title' | 'createdAt' | 'updatedAt' | 'mentions';
export type NoteSortOrder = 'asc' | 'desc';

/** Asc default for title; desc for dates and mentions count (highest first). */
export function isNoteAscDefaultField(field: NoteSortField): boolean {
  return isNoteStringSortField(field);
}

/** Header-click sort: toggle order on same field, else switch field with default order. */
export function nextNoteTableSort(
  currentField: NoteSortField,
  currentOrder: NoteSortOrder,
  nextField: NoteSortField,
): { field: NoteSortField; order: NoteSortOrder } {
  return nextListTableSort(currentField, currentOrder, nextField, isNoteAscDefaultField);
}

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
