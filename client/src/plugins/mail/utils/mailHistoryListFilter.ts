import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

/** Selectable filters (excluding "all", which clears the selection). */
export type MailHistoryListFilter = 'withSource' | 'today';

/** Empty array = show all. Multiple filters are AND-combined. */
export type MailHistoryListFilterSelection = MailHistoryListFilter[];

export function mailHistoryMatchesSingleFilter(
  entry: { pluginSource?: string | null; sentAt?: string | Date | null },
  filter: MailHistoryListFilter,
): boolean {
  if (filter === 'withSource') {
    return Boolean(entry.pluginSource);
  }
  if (filter === 'today') {
    if (!entry.sentAt) {
      return false;
    }
    return new Date(entry.sentAt).toDateString() === new Date().toDateString();
  }
  return true;
}

export function mailHistoryMatchesListFilters(
  entry: { pluginSource?: string | null; sentAt?: string | Date | null },
  selection: readonly MailHistoryListFilter[],
): boolean {
  return itemMatchesListFilters(entry, selection, mailHistoryMatchesSingleFilter);
}

export function toggleMailHistoryListFilter(
  current: readonly MailHistoryListFilter[],
  next: MailHistoryListFilter | 'all',
): MailHistoryListFilter[] {
  if (next === 'all') {
    return [];
  }
  return toggleListFilterSelection(current, next);
}
