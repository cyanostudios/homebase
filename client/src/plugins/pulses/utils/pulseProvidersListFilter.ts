import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { PulseProviderSettings } from '../types/pulse';

/** Selectable filters (excluding "all", which clears the selection). */
export type PulseProvidersListFilter = 'enabled' | 'disabled' | 'configured';

/** Empty array = show all providers. Multiple filters are AND-combined. */
export type PulseProvidersListFilterSelection = PulseProvidersListFilter[];

const ENABLED_FILTERS = [
  'enabled',
  'disabled',
] as const satisfies readonly PulseProvidersListFilter[];

export const PULSE_PROVIDERS_LIST_FILTER_EXCLUSIVE_GROUPS = [ENABLED_FILTERS] as const;

export function pulseProviderMatchesSingleFilter(
  provider: Pick<PulseProviderSettings, 'enabled' | 'configured'>,
  filter: PulseProvidersListFilter,
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
export function pulseProviderMatchesListFilters(
  provider: Pick<PulseProviderSettings, 'enabled' | 'configured'>,
  filters: PulseProvidersListFilterSelection,
): boolean {
  return itemMatchesListFilters(provider, filters, (item, filter) =>
    pulseProviderMatchesSingleFilter(item, filter),
  );
}

/**
 * Toggle a filter for multi-select.
 * enabled/disabled replace each other; configured toggles independently.
 */
export function togglePulseProvidersListFilter(
  current: PulseProvidersListFilterSelection,
  filter: PulseProvidersListFilter,
): PulseProvidersListFilterSelection {
  return toggleListFilterSelection(current, filter, PULSE_PROVIDERS_LIST_FILTER_EXCLUSIVE_GROUPS);
}
