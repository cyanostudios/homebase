import { itemMatchesListFilters, toggleListFilterSelection } from '@/core/list/listFilterSelection';

import type { ProviderSettings } from '../types/aiProviders';

/** Selectable filters (excluding "all", which clears the selection). */
export type AIProvidersListFilter = 'enabled' | 'disabled' | 'configured';

/** Empty array = show all providers. Multiple filters are AND-combined. */
export type AIProvidersListFilterSelection = AIProvidersListFilter[];

const ENABLED_FILTERS = ['enabled', 'disabled'] as const satisfies readonly AIProvidersListFilter[];

export const AI_PROVIDERS_LIST_FILTER_EXCLUSIVE_GROUPS = [ENABLED_FILTERS] as const;

export function aiProviderMatchesSingleFilter(
  provider: Pick<ProviderSettings, 'enabled' | 'hasApiKey'>,
  filter: AIProvidersListFilter,
): boolean {
  if (filter === 'enabled') {
    return provider.enabled;
  }
  if (filter === 'disabled') {
    return !provider.enabled;
  }
  if (filter === 'configured') {
    return provider.hasApiKey;
  }
  return true;
}

/** AND across selected filters. Empty selection = all providers. */
export function aiProviderMatchesListFilters(
  provider: Pick<ProviderSettings, 'enabled' | 'hasApiKey'>,
  filters: AIProvidersListFilterSelection,
): boolean {
  return itemMatchesListFilters(provider, filters, (item, filter) =>
    aiProviderMatchesSingleFilter(item, filter),
  );
}

/**
 * Toggle a filter for multi-select.
 * enabled/disabled replace each other; configured toggles independently.
 */
export function toggleAIProvidersListFilter(
  current: AIProvidersListFilterSelection,
  filter: AIProvidersListFilter,
): AIProvidersListFilterSelection {
  return toggleListFilterSelection(current, filter, AI_PROVIDERS_LIST_FILTER_EXCLUSIVE_GROUPS);
}
