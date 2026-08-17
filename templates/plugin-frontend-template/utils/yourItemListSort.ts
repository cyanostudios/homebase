import type { YourItem } from '../types/your-items';

export type YourItemSortField = 'title' | 'updatedAt' | 'createdAt' | 'id';
export type YourItemSortOrder = 'asc' | 'desc';

const STRING_SORT_FIELDS: YourItemSortField[] = ['title', 'id'];

export function isYourItemAscDefaultField(field: YourItemSortField): boolean {
  return STRING_SORT_FIELDS.includes(field);
}

export function compareYourItemsByField(
  a: YourItem,
  b: YourItem,
  field: YourItemSortField,
  order: YourItemSortOrder,
): number {
  if (field === 'title' || field === 'id') {
    const av = String(field === 'title' ? a.title : a.id).toLowerCase();
    const bv = String(field === 'title' ? b.title : b.id).toLowerCase();
    const res = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return order === 'asc' ? res : -res;
  }

  const aTime = a[field] ? new Date(a[field]).getTime() : 0;
  const bTime = b[field] ? new Date(b[field]).getTime() : 0;
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}
