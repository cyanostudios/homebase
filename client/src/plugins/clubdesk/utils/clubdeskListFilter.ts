import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { PublicationStatus } from '../types/clubdesk';

/** Selectable filters (excluding "all", which clears the selection). */
export type ClubdeskListFilter = 'draft' | 'published';

/** Empty array = show all. Multiple filters are AND-combined. */
export type ClubdeskListFilterSelection = ClubdeskListFilter[];

const STATUS_FILTERS = ['draft', 'published'] as const satisfies readonly ClubdeskListFilter[];

export const CLUBDESK_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function clubdeskMatchesSingleFilter(
  item: { publicationStatus: PublicationStatus },
  filter: ClubdeskListFilter,
): boolean {
  return item.publicationStatus === filter;
}

/** AND across selected filters. Empty selection = all clubdesk items. */
export function clubdeskMatchesListFilters(
  item: { publicationStatus: PublicationStatus },
  filters: ClubdeskListFilterSelection,
): boolean {
  return itemMatchesListFilters(item, filters, clubdeskMatchesSingleFilter);
}

export function toggleClubdeskListFilter(
  current: ClubdeskListFilterSelection,
  filter: ClubdeskListFilter,
): ClubdeskListFilterSelection {
  return toggleListFilterSelection(current, filter, CLUBDESK_LIST_FILTER_EXCLUSIVE_GROUPS);
}
