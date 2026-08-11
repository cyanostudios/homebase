import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { MailProviderSettings } from '../types/mail';

/** Selectable filters (excluding "all", which clears the selection). */
export type MailProvidersListFilter = 'enabled' | 'disabled' | 'configured';

/** Empty array = show all providers. Multiple filters are AND-combined. */
export type MailProvidersListFilterSelection = MailProvidersListFilter[];

const ENABLED_FILTERS = [
  'enabled',
  'disabled',
] as const satisfies readonly MailProvidersListFilter[];

export const MAIL_PROVIDERS_LIST_FILTER_EXCLUSIVE_GROUPS = [ENABLED_FILTERS] as const;

export function mailProviderMatchesSingleFilter(
  provider: Pick<MailProviderSettings, 'enabled' | 'configured'>,
  filter: MailProvidersListFilter,
): boolean {
  if (filter === 'enabled') {
    return provider.enabled;
  }
  if (filter === 'disabled') {
    return !provider.enabled;
  }
  if (filter === 'configured') {
    return provider.configured;
  }
  return true;
}

/** AND across selected filters. Empty selection = all providers. */
export function mailProviderMatchesListFilters(
  provider: Pick<MailProviderSettings, 'enabled' | 'configured'>,
  filters: MailProvidersListFilterSelection,
): boolean {
  return itemMatchesListFilters(provider, filters, (item, filter) =>
    mailProviderMatchesSingleFilter(item, filter),
  );
}

/**
 * Toggle a filter for multi-select.
 * enabled/disabled replace each other; configured toggles independently.
 */
export function toggleMailProvidersListFilter(
  current: MailProvidersListFilterSelection,
  filter: MailProvidersListFilter,
): MailProvidersListFilterSelection {
  return toggleListFilterSelection(current, filter, MAIL_PROVIDERS_LIST_FILTER_EXCLUSIVE_GROUPS);
}
