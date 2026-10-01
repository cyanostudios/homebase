/**
 * Shared helpers for KPI tiles that apply list filter chips (set, not toggle).
 */

export function isStatKpiListFilterPressed<T extends string>(
  activeFilters: readonly T[],
  key: T | 'total',
): boolean {
  return key === 'total' ? activeFilters.length === 0 : activeFilters.includes(key);
}

export function handleStatKpiListFilterSelect<T extends string>(
  filter: T | 'total',
  setFiltersVisible: (visible: boolean) => void,
  setActiveFilters: (next: T[]) => void,
): void {
  setFiltersVisible(true);
  if (filter === 'total') {
    setActiveFilters([]);
    return;
  }
  setActiveFilters([filter]);
}
