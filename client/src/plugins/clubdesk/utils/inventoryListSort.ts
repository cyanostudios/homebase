import type { ClubdeskInventoryItem } from '../types/inventory';

export type InventorySortField =
  | 'articleName'
  | 'brand'
  | 'totalQuantity'
  | 'variantCount'
  | 'updatedAt'
  | 'createdAt'
  | 'publicationStatus'
  | 'id';

export type InventorySortOrder = 'asc' | 'desc';

const STRING_FIELDS: InventorySortField[] = ['articleName', 'brand', 'id', 'publicationStatus'];

export function isInventoryAscDefaultField(field: InventorySortField): boolean {
  return STRING_FIELDS.includes(field);
}

export function compareInventoryByField(
  a: ClubdeskInventoryItem,
  b: ClubdeskInventoryItem,
  field: InventorySortField,
  order: InventorySortOrder,
): number {
  if (field === 'totalQuantity') {
    const av = a.totalQuantity ?? 0;
    const bv = b.totalQuantity ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  if (field === 'variantCount') {
    const av = a.variantCount ?? 0;
    const bv = b.variantCount ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  if (
    field === 'articleName' ||
    field === 'brand' ||
    field === 'id' ||
    field === 'publicationStatus'
  ) {
    const av = String(
      field === 'articleName'
        ? a.articleName
        : field === 'brand'
          ? a.brand
          : field === 'publicationStatus'
            ? a.publicationStatus
            : a.id,
    ).toLowerCase();
    const bv = String(
      field === 'articleName'
        ? b.articleName
        : field === 'brand'
          ? b.brand
          : field === 'publicationStatus'
            ? b.publicationStatus
            : b.id,
    ).toLowerCase();
    const res = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return order === 'asc' ? res : -res;
  }
  const timeField = field === 'createdAt' ? 'createdAt' : 'updatedAt';
  const aTime = a[timeField] ? new Date(a[timeField]).getTime() : 0;
  const bTime = b[timeField] ? new Date(b[timeField]).getTime() : 0;
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}
