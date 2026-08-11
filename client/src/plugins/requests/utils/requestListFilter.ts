import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import { isOpenRequestStatus, type RequestStatus } from '../types/requests';

/**
 * Selectable status filters for ListFilterStatCard cards.
 * "all" clears selection and is not stored. External/unlinked stay separate.
 */
export type RequestListFilter = 'active' | 'completed' | 'cancelled';

/** Empty array = show all. Default list selection is `['active']`. */
export type RequestListFilterSelection = RequestListFilter[];

const STATUS_FILTERS = [
  'active',
  'completed',
  'cancelled',
] as const satisfies readonly RequestListFilter[];

export const REQUEST_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export const REQUEST_LIST_FILTER_INITIAL: RequestListFilterSelection = ['active'];

export function requestMatchesSingleFilter(
  request: { status: RequestStatus | string },
  filter: RequestListFilter,
): boolean {
  if (filter === 'active') {
    return isOpenRequestStatus(request.status);
  }
  return request.status === filter;
}

/** AND across selected filters. Empty selection = all requests. */
export function requestMatchesListFilters(
  request: { status: RequestStatus | string },
  filters: RequestListFilterSelection,
): boolean {
  return itemMatchesListFilters(request, filters, requestMatchesSingleFilter);
}

export function toggleRequestListFilter(
  current: RequestListFilterSelection,
  filter: RequestListFilter,
): RequestListFilterSelection {
  return toggleListFilterSelection(current, filter, REQUEST_LIST_FILTER_EXCLUSIVE_GROUPS);
}

/** True when selection differs from the default active-only view. */
export function isRequestListStatusFilterNonDefault(filters: RequestListFilterSelection): boolean {
  return filters.length !== 1 || filters[0] !== 'active';
}
