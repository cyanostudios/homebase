/**
 * Shared multi-select mechanics for ListFilterStatCard list filters (Matches pattern).
 * Empty selection = All. Exclusive groups replace within the group; other filters toggle.
 * Matching across selected filters is AND (caller supplies per-filter predicate).
 */

export type ListFilterExclusiveGroups<T extends string> = readonly (readonly T[])[];

/** Toggle a filter. Filters in the same exclusive group replace each other. */
export function toggleListFilterSelection<T extends string>(
  current: readonly T[],
  filter: T,
  exclusiveGroups: ListFilterExclusiveGroups<T> = [],
): T[] {
  const group = exclusiveGroups.find((g) => g.includes(filter));
  if (group) {
    const withoutGroup = current.filter((item) => !group.includes(item));
    if (current.includes(filter)) {
      return withoutGroup;
    }
    return [...withoutGroup, filter];
  }
  if (current.includes(filter)) {
    return current.filter((item) => item !== filter);
  }
  return [...current, filter];
}

/** Empty selection matches everything; otherwise every selected filter must match. */
export function itemMatchesListFilters<TItem, TFilter extends string>(
  item: TItem,
  filters: readonly TFilter[],
  matchOne: (item: TItem, filter: TFilter) => boolean,
): boolean {
  if (filters.length === 0) {
    return true;
  }
  return filters.every((filter) => matchOne(item, filter));
}

export function isListFilterActive<T extends string>(selection: readonly T[], filter: T): boolean {
  return selection.includes(filter);
}

export function isListFilterSelectionEmpty<T extends string>(selection: readonly T[]): boolean {
  return selection.length === 0;
}
