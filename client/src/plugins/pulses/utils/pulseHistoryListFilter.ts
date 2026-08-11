import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

/** Selectable filters (excluding "all", which clears the selection). */
export type PulseHistoryListFilter = 'failed' | 'today';

/** Empty array = show all. Multiple filters are AND-combined. */
export type PulseHistoryListFilterSelection = PulseHistoryListFilter[];

export function pulseHistoryMatchesSingleFilter(
  entry: { status?: string | null; sentAt?: string | Date | null },
  filter: PulseHistoryListFilter,
): boolean {
  if (filter === 'failed') {
    return String(entry.status || '').toLowerCase() === 'failed';
  }
  if (filter === 'today') {
    if (!entry.sentAt) {
      return false;
    }
    return new Date(entry.sentAt).toDateString() === new Date().toDateString();
  }
  return true;
}

export function pulseHistoryMatchesListFilters(
  entry: { status?: string | null; sentAt?: string | Date | null },
  selection: readonly PulseHistoryListFilter[],
): boolean {
  return itemMatchesListFilters(entry, selection, pulseHistoryMatchesSingleFilter);
}

export function togglePulseHistoryListFilter(
  current: readonly PulseHistoryListFilter[],
  next: PulseHistoryListFilter | 'all',
): PulseHistoryListFilter[] {
  if (next === 'all') {
    return [];
  }
  return toggleListFilterSelection(current, next);
}
