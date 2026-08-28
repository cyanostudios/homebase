import { useViewportTier, type ViewportTier } from '@/hooks/useMediaQuery';

import type { ListViewMode } from './listViewMode';

export type EffectiveColumnOptions = {
  /** When true on desktop, card grid displays 2 columns (persisted preference unchanged). */
  quickContextOpen?: boolean;
};

/**
 * Display-only overrides by viewport tier (ADR VIEWPORT_TIER_PAD_SPLIT):
 * - phone: always cards, 1-column grid, card content uses column-2 layout
 * - pad: always cards, grid columns clamped to max 2
 * - desktop: persisted preference; quick context open → 2 columns
 * Does not mutate persisted preferences.
 */
export function getEffectiveListViewMode(
  listViewMode: ListViewMode,
  tier: ViewportTier,
): ListViewMode {
  if (tier === 'phone' || tier === 'pad') {
    return 'cards';
  }
  return listViewMode;
}

export function useEffectiveListViewMode(listViewMode: ListViewMode): ListViewMode {
  const tier = useViewportTier();
  return getEffectiveListViewMode(listViewMode, tier);
}

export function useIsEffectiveTableView(listViewMode: ListViewMode): boolean {
  return useEffectiveListViewMode(listViewMode) === 'table';
}

/** Grid columns: phone → 1; pad → min(preference, 2); desktop → preference (or 2 if quick context). */
export function getEffectiveColumnCount<T extends 1 | 2 | 3>(
  columnCount: T,
  tier: ViewportTier,
  options?: EffectiveColumnOptions,
): 1 | 2 | 3 {
  if (tier === 'phone') {
    return 1;
  }
  if (tier === 'pad') {
    return (columnCount > 2 ? 2 : columnCount) as 1 | 2;
  }
  if (options?.quickContextOpen) {
    return 2;
  }
  return columnCount;
}

export function useEffectiveColumnCount<T extends 1 | 2 | 3>(
  columnCount: T,
  options?: EffectiveColumnOptions,
): 1 | 2 | 3 {
  const tier = useViewportTier();
  return getEffectiveColumnCount(columnCount, tier, options);
}

/** Card content layout: phone → column-2 style; pad/desktop → effective grid count. */
export function getEffectiveCardColumnCount<T extends 1 | 2 | 3>(
  columnCount: T,
  tier: ViewportTier,
  options?: EffectiveColumnOptions,
): 1 | 2 | 3 {
  if (tier === 'phone') {
    return 2;
  }
  return getEffectiveColumnCount(columnCount, tier, options);
}

export function useEffectiveCardColumnCount<T extends 1 | 2 | 3>(
  columnCount: T,
  options?: EffectiveColumnOptions,
): 1 | 2 | 3 {
  const tier = useViewportTier();
  return getEffectiveCardColumnCount(columnCount, tier, options);
}
