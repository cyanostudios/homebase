import { useCallback, useMemo } from 'react';

import { orderItemsByBrowseIds } from '@/core/utils/orderItemsByBrowseIds';

/**
 * Shared navigation hook for plugin detail panels.
 *
 * Computes prev/next navigation state and callbacks from an ordered list of
 * items and the currently selected item.  The returned `currentItemIndex` is
 * 1-based (display-ready) and 0 when nothing is selected.
 *
 * Pass `browseOrderIds` (visible filtered/sorted list order from `*List.tsx`)
 * so prev/next matches what the user sees in the list.
 *
 * Usage inside a plugin context:
 *
 *   const { navigateToPrevItem, navigateToNextItem, hasPrevItem, hasNextItem,
 *           currentItemIndex, totalItems } =
 *     usePluginNavigation(items, currentItem, openForView, browseOrderIds);
 */
export function usePluginNavigation<T extends { id: string }>(
  items: T[],
  currentItem: T | null,
  openForView: (item: T) => void,
  browseOrderIds?: string[] | null,
) {
  const navItems = useMemo(
    () => orderItemsByBrowseIds(items, browseOrderIds),
    [items, browseOrderIds],
  );
  const rawIndex = currentItem ? navItems.findIndex((item) => item.id === currentItem.id) : -1;
  const totalItems = navItems.length;
  const hasPrevItem = rawIndex > 0;
  const hasNextItem = rawIndex >= 0 && rawIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || rawIndex <= 0) {
      return;
    }
    const prev = navItems[rawIndex - 1];
    if (prev) {
      openForView(prev);
    }
  }, [hasPrevItem, rawIndex, navItems, openForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || rawIndex < 0 || rawIndex >= navItems.length - 1) {
      return;
    }
    const next = navItems[rawIndex + 1];
    if (next) {
      openForView(next);
    }
  }, [hasNextItem, rawIndex, navItems, openForView]);

  return {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: rawIndex === -1 ? 0 : rawIndex + 1,
    totalItems,
  };
}
