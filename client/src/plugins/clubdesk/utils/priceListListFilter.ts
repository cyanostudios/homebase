import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { PublicationStatus } from '../types/clubdesk';

/** Selectable filters (excluding "all", which clears the selection). */
export type PriceListListFilter = 'draft' | 'published';

/** Empty array = show all. Multiple filters are AND-combined. */
export type PriceListListFilterSelection = PriceListListFilter[];

const STATUS_FILTERS = ['draft', 'published'] as const satisfies readonly PriceListListFilter[];

export const PRICE_LIST_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function priceListMatchesSingleFilter(
  item: { publicationStatus: PublicationStatus },
  filter: PriceListListFilter,
): boolean {
  return item.publicationStatus === filter;
}

/** AND across selected filters. Empty selection = all price lists. */
export function priceListMatchesListFilters(
  item: { publicationStatus: PublicationStatus },
  filters: PriceListListFilterSelection,
): boolean {
  return itemMatchesListFilters(item, filters, priceListMatchesSingleFilter);
}

export function togglePriceListListFilter(
  current: PriceListListFilterSelection,
  filter: PriceListListFilter,
): PriceListListFilterSelection {
  return toggleListFilterSelection(current, filter, PRICE_LIST_LIST_FILTER_EXCLUSIVE_GROUPS);
}
