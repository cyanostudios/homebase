import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

/** Selectable filters (excluding "all", which clears the selection). */
export type EstimateListFilter = 'draft' | 'sent' | 'accepted';

/** Empty array = show all. Multiple filters are AND-combined. */
export type EstimateListFilterSelection = EstimateListFilter[];

const STATUS_FILTERS = [
  'draft',
  'sent',
  'accepted',
] as const satisfies readonly EstimateListFilter[];

export const ESTIMATE_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function estimateMatchesSingleFilter(
  item: Pick<{ status: string }, 'status'>,
  filter: EstimateListFilter,
): boolean {
  return item.status === filter;
}

/** AND across selected filters. Empty selection = all estimates. */
export function estimateMatchesListFilters(
  item: Pick<{ status: string }, 'status'>,
  filters: EstimateListFilterSelection,
): boolean {
  return itemMatchesListFilters(item, filters, estimateMatchesSingleFilter);
}

export function toggleEstimateListFilter(
  current: EstimateListFilterSelection,
  filter: EstimateListFilter,
): EstimateListFilterSelection {
  return toggleListFilterSelection(current, filter, ESTIMATE_LIST_FILTER_EXCLUSIVE_GROUPS);
}
