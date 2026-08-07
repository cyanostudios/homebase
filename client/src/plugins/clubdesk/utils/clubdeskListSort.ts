import type { Clubdesk } from '../types/clubdesk';

export type ClubdeskSortField = 'updatedAt' | 'title' | 'createdAt' | 'publicationStatus';
export type ClubdeskSortOrder = 'asc' | 'desc';

export function isClubdeskStringSortField(field: ClubdeskSortField): boolean {
  return field === 'title' || field === 'publicationStatus';
}

export function compareClubdesksByField(
  a: Clubdesk,
  b: Clubdesk,
  field: ClubdeskSortField,
  order: ClubdeskSortOrder,
): number {
  let av: string | number = '';
  let bv: string | number = '';
  switch (field) {
    case 'updatedAt':
      av = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      bv = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      break;
    case 'createdAt':
      av = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      bv = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      break;
    case 'publicationStatus':
      av = a.publicationStatus || '';
      bv = b.publicationStatus || '';
      break;
    case 'title':
    default:
      av = (a.title || '').toLowerCase();
      bv = (b.title || '').toLowerCase();
  }
  if (typeof av === 'number' && typeof bv === 'number') {
    return order === 'asc' ? av - bv : bv - av;
  }
  const res = String(av).localeCompare(String(bv), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  return order === 'asc' ? res : -res;
}
