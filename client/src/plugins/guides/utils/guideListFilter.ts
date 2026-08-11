import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { Guide } from '../types/guides';

/** Selectable filters (excluding "all", which clears the selection). */
export type GuideListFilter = 'draft' | 'active' | 'audioReady';

/** Empty array = show all guides. Multiple filters are AND-combined. */
export type GuideListFilterSelection = GuideListFilter[];

const STATUS_FILTERS = ['draft', 'active'] as const satisfies readonly GuideListFilter[];

export const GUIDE_LIST_FILTER_EXCLUSIVE_GROUPS = [STATUS_FILTERS] as const;

export function guideMatchesSingleFilter(
  guide: Pick<Guide, 'lifecycleStatus' | 'hasReadyAudio'>,
  filter: GuideListFilter,
): boolean {
  if (filter === 'draft') {
    return guide.lifecycleStatus === 'draft';
  }
  if (filter === 'active') {
    return guide.lifecycleStatus === 'active';
  }
  if (filter === 'audioReady') {
    return Boolean(guide.hasReadyAudio);
  }
  return true;
}

/** AND across selected filters. Empty selection = all guides. */
export function guideMatchesListFilters(
  guide: Pick<Guide, 'lifecycleStatus' | 'hasReadyAudio'>,
  filters: GuideListFilterSelection,
): boolean {
  return itemMatchesListFilters(guide, filters, (item, filter) =>
    guideMatchesSingleFilter(item, filter),
  );
}

/**
 * Toggle a filter for multi-select.
 * draft/active replace each other; audioReady toggles independently.
 */
export function toggleGuideListFilter(
  current: GuideListFilterSelection,
  filter: GuideListFilter,
): GuideListFilterSelection {
  return toggleListFilterSelection(current, filter, GUIDE_LIST_FILTER_EXCLUSIVE_GROUPS);
}
