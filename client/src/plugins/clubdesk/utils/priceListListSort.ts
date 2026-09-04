import type { ClubdeskPriceList } from '../types/priceList';

export type PriceListSortField =
  | 'updatedAt'
  | 'title'
  | 'createdAt'
  | 'publicationStatus'
  | 'currency'
  | 'itemCount';
export type PriceListSortOrder = 'asc' | 'desc';

/** Strings/categories asc; dates and itemCount magnitude desc (highest first). */
export function isPriceListAscDefaultField(field: PriceListSortField): boolean {
  return field === 'title' || field === 'publicationStatus' || field === 'currency';
}

export function comparePriceListsByField(
  a: ClubdeskPriceList,
  b: ClubdeskPriceList,
  field: PriceListSortField,
  order: PriceListSortOrder,
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
    case 'currency':
      av = (a.currency || '').toLowerCase();
      bv = (b.currency || '').toLowerCase();
      break;
    case 'itemCount':
      av = a.itemCount ?? a.items?.length ?? 0;
      bv = b.itemCount ?? b.items?.length ?? 0;
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
