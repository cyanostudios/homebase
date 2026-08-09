import { nextListTableSort } from '@/core/list/listViewMode';

import type { Slot } from '../types/slots';

export type SlotSortField =
  | 'name'
  | 'slot_time'
  | 'location'
  | 'updatedAt'
  | 'category'
  | 'visible'
  | 'booked_count';
export type SlotSortOrder = 'asc' | 'desc';

/** Default asc for name/location/slot_time/category/visible/booked; desc for updatedAt. */
export function isSlotAscDefaultField(field: SlotSortField): boolean {
  return field !== 'updatedAt';
}

/** Header-click sort: toggle order on same field, else switch field with default order. */
export function nextSlotTableSort(
  currentField: SlotSortField,
  currentOrder: SlotSortOrder,
  nextField: SlotSortField,
): { field: SlotSortField; order: SlotSortOrder } {
  return nextListTableSort(currentField, currentOrder, nextField, isSlotAscDefaultField);
}

type SlotSortable = Pick<
  Slot,
  'name' | 'location' | 'slot_time' | 'updated_at' | 'category' | 'visible' | 'booked_count'
>;

function toSortTime(value: Date | string): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function compareNullableTimes(
  aValue: Date | string | null | undefined,
  bValue: Date | string | null | undefined,
  order: SlotSortOrder,
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

function getSlotDateValue(
  slot: Pick<Slot, 'slot_time' | 'updated_at'>,
  field: 'slot_time' | 'updatedAt',
): string | null {
  if (field === 'slot_time') {
    return slot.slot_time || null;
  }
  return slot.updated_at || null;
}

export function compareSlotsByField(
  a: SlotSortable,
  b: SlotSortable,
  field: SlotSortField,
  order: SlotSortOrder,
): number {
  if (field === 'slot_time' || field === 'updatedAt') {
    return compareNullableTimes(
      getSlotDateValue(a, field),
      getSlotDateValue(b, field),
      order,
      toSortTime,
    );
  }

  if (field === 'visible') {
    const av = a.visible ? 1 : 0;
    const bv = b.visible ? 1 : 0;
    return order === 'asc' ? av - bv : bv - av;
  }

  if (field === 'booked_count') {
    const av = a.booked_count ?? 0;
    const bv = b.booked_count ?? 0;
    return order === 'asc' ? av - bv : bv - av;
  }

  let aVal: string;
  let bVal: string;
  if (field === 'name') {
    aVal = (a.name?.trim() || a.location || '').toLowerCase();
    bVal = (b.name?.trim() || b.location || '').toLowerCase();
  } else if (field === 'category') {
    aVal = (a.category ?? '').toLowerCase();
    bVal = (b.category ?? '').toLowerCase();
  } else {
    aVal = (a.location ?? '').toLowerCase();
    bVal = (b.location ?? '').toLowerCase();
  }
  const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
  return order === 'asc' ? cmp : -cmp;
}
