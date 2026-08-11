import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { Cup } from '../types/cups';

/** Selectable filters (excluding "all", which clears the selection). */
export type CupListFilter = 'visible' | 'featured' | 'upcoming' | 'removed';

/** Empty array = show all non-removed cups. Facets AND; removed is a special view. */
export type CupListFilterSelection = CupListFilter[];

/** Removed is handled by custom toggle (clears facets); facets toggle independently. */

export function cupIsRemoved(cup: Pick<Cup, 'deleted_at'>): boolean {
  return cup.deleted_at !== null && cup.deleted_at !== undefined;
}

export function cupIsUpcoming(
  startDate: string | null | undefined,
  todayStartMs: number = (() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return todayStart.getTime();
  })(),
): boolean {
  if (!startDate) {
    return false;
  }
  const startDateMs = new Date(startDate).getTime();
  return Number.isFinite(startDateMs) && startDateMs >= todayStartMs;
}

export function cupMatchesSingleFilter(
  cup: Pick<Cup, 'deleted_at' | 'visible' | 'featured' | 'start_date'>,
  filter: CupListFilter,
  todayStartMs?: number,
): boolean {
  if (filter === 'removed') {
    return cupIsRemoved(cup);
  }
  if (cupIsRemoved(cup)) {
    return false;
  }
  if (filter === 'visible') {
    return Boolean(cup.visible);
  }
  if (filter === 'featured') {
    return Boolean(cup.featured);
  }
  if (filter === 'upcoming') {
    return cupIsUpcoming(cup.start_date, todayStartMs);
  }
  return true;
}

/**
 * Empty selection = all non-removed cups.
 * If `removed` is selected, only removed cups match (other filters ignored).
 * Otherwise facets are AND-combined and removed cups are excluded.
 */
export function cupMatchesListFilters(
  cup: Pick<Cup, 'deleted_at' | 'visible' | 'featured' | 'start_date'>,
  filters: CupListFilterSelection,
  todayStartMs?: number,
): boolean {
  if (filters.includes('removed')) {
    return cupIsRemoved(cup);
  }
  if (cupIsRemoved(cup)) {
    return false;
  }
  return itemMatchesListFilters(cup, filters, (item, filter) =>
    cupMatchesSingleFilter(item, filter, todayStartMs),
  );
}

/**
 * Toggle a cup list filter.
 * Selecting removed clears other filters; selecting a facet clears removed.
 * visible/featured/upcoming toggle independently (AND).
 */
export function toggleCupListFilter(
  current: CupListFilterSelection,
  filter: CupListFilter,
): CupListFilterSelection {
  if (filter === 'removed') {
    if (current.includes('removed')) {
      return current.filter((item) => item !== 'removed');
    }
    return ['removed'];
  }
  const withoutRemoved = current.filter((item) => item !== 'removed');
  return toggleListFilterSelection(withoutRemoved, filter, []);
}
