import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { IngestFetchStatus, IngestSource } from '../types/ingest';

/** Selectable filters (excluding "all", which clears the selection). */
export type IngestListFilter = 'active' | 'success' | 'failed';

/** Empty array = show all. success/failed are exclusive; active is a facet. */
export type IngestListFilterSelection = IngestListFilter[];

const FETCH_STATUS_FILTERS = ['success', 'failed'] as const satisfies readonly IngestListFilter[];

export const INGEST_LIST_FILTER_EXCLUSIVE_GROUPS = [FETCH_STATUS_FILTERS] as const;

export function ingestMatchesSingleFilter(
  source: Pick<IngestSource, 'isActive' | 'lastFetchStatus'>,
  filter: IngestListFilter,
): boolean {
  if (filter === 'active') {
    return Boolean(source.isActive);
  }
  if (filter === 'success' || filter === 'failed') {
    return source.lastFetchStatus === (filter as IngestFetchStatus);
  }
  return true;
}

/** AND across selected filters. Empty selection = all sources. */
export function ingestMatchesListFilters(
  source: Pick<IngestSource, 'isActive' | 'lastFetchStatus'>,
  filters: IngestListFilterSelection,
): boolean {
  return itemMatchesListFilters(source, filters, ingestMatchesSingleFilter);
}

/**
 * Toggle an ingest list filter.
 * success/failed replace each other; active toggles independently.
 */
export function toggleIngestListFilter(
  current: IngestListFilterSelection,
  filter: IngestListFilter,
): IngestListFilterSelection {
  return toggleListFilterSelection(current, filter, INGEST_LIST_FILTER_EXCLUSIVE_GROUPS);
}
