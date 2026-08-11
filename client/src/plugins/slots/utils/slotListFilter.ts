import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { Slot } from '../types/slots';

/** Selectable filters (excluding "all", which clears the selection). */
export type SlotListFilter = 'visible' | 'upcoming' | 'withCategory';

/** Empty array = show all slots. Multiple filters are AND-combined. */
export type SlotListFilterSelection = SlotListFilter[];

export const SLOT_LIST_FILTER_EXCLUSIVE_GROUPS = [] as const;

export function slotIsVisible(slot: Pick<Slot, 'visible'>): boolean {
  return Boolean(slot.visible);
}

export function slotIsUpcoming(slot: Pick<Slot, 'slot_time'>, nowMs: number = Date.now()): boolean {
  const time = new Date(slot.slot_time).getTime();
  return Number.isFinite(time) && time > nowMs;
}

export function slotHasCategory(slot: Pick<Slot, 'category'>): boolean {
  return Boolean(slot.category?.trim());
}

export function slotMatchesSingleFilter(
  slot: Pick<Slot, 'visible' | 'slot_time' | 'category'>,
  filter: SlotListFilter,
  nowMs: number = Date.now(),
): boolean {
  if (filter === 'visible') {
    return slotIsVisible(slot);
  }
  if (filter === 'upcoming') {
    return slotIsUpcoming(slot, nowMs);
  }
  if (filter === 'withCategory') {
    return slotHasCategory(slot);
  }
  return true;
}

/** AND across selected filters. Empty selection = all slots. */
export function slotMatchesListFilters(
  slot: Pick<Slot, 'visible' | 'slot_time' | 'category'>,
  filters: SlotListFilterSelection,
  nowMs: number = Date.now(),
): boolean {
  return itemMatchesListFilters(slot, filters, (item, filter) =>
    slotMatchesSingleFilter(item, filter, nowMs),
  );
}

/**
 * Toggle a filter for multi-select.
 * All slot facets toggle independently (no exclusive groups).
 */
export function toggleSlotListFilter(
  current: SlotListFilterSelection,
  filter: SlotListFilter,
): SlotListFilterSelection {
  return toggleListFilterSelection(current, filter, SLOT_LIST_FILTER_EXCLUSIVE_GROUPS);
}
