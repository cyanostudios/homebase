import type { GarmentList, InventoryItem } from '../types/garments';

export type GarmentSortField = 'name' | 'updatedAt' | 'createdAt' | 'id' | 'personCount';
export type InventorySortField =
  | 'articleName'
  | 'brand'
  | 'totalQuantity'
  | 'variantCount'
  | 'updatedAt'
  | 'id';
export type GarmentSortOrder = 'asc' | 'desc';

const LIST_STRING_FIELDS: GarmentSortField[] = ['name', 'id'];
const INVENTORY_STRING_FIELDS: InventorySortField[] = ['articleName', 'brand', 'id'];

export function isGarmentAscDefaultField(field: GarmentSortField): boolean {
  return LIST_STRING_FIELDS.includes(field);
}

/** Strings asc; dates and magnitude (qty / variant count) desc (highest first). */
export function isInventoryAscDefaultField(field: InventorySortField): boolean {
  return INVENTORY_STRING_FIELDS.includes(field);
}

export function compareGarmentListsByField(
  a: GarmentList,
  b: GarmentList,
  field: GarmentSortField,
  order: GarmentSortOrder,
): number {
  if (field === 'name' || field === 'id') {
    const av = String(field === 'name' ? a.name : a.id).toLowerCase();
    const bv = String(field === 'name' ? b.name : b.id).toLowerCase();
    const res = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return order === 'asc' ? res : -res;
  }
  if (field === 'personCount') {
    const av = a.personCount ?? a.persons?.length ?? 0;
    const bv = b.personCount ?? b.persons?.length ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  const aTime = a[field] ? new Date(a[field]).getTime() : 0;
  const bTime = b[field] ? new Date(b[field]).getTime() : 0;
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}

export function compareInventoryByField(
  a: InventoryItem,
  b: InventoryItem,
  field: InventorySortField,
  order: GarmentSortOrder,
): number {
  if (field === 'totalQuantity') {
    const av = a.totalQuantity ?? 0;
    const bv = b.totalQuantity ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  if (field === 'variantCount') {
    const av = a.variantCount ?? a.variants?.length ?? 0;
    const bv = b.variantCount ?? b.variants?.length ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }
  if (field === 'articleName' || field === 'brand' || field === 'id') {
    const av = String(a[field] ?? '').toLowerCase();
    const bv = String(b[field] ?? '').toLowerCase();
    const res = av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return order === 'asc' ? res : -res;
  }
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return order === 'asc' ? aTime - bTime : bTime - aTime;
}
