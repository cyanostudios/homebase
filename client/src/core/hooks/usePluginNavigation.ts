import { useCallback } from 'react';

/**
 * Shared navigation hook for plugin detail panels.
 *
 * Computes prev/next navigation state and callbacks from an ordered list of
 * items and the currently selected item.  The returned `currentItemIndex` is
 * 1-based (display-ready) and 0 when nothing is selected.
 *
 * Usage inside a plugin context:
 *
 *   const { navigateToPrevItem, navigateToNextItem, hasPrevItem, hasNextItem,
 *           currentItemIndex, totalItems } =
 *     usePluginNavigation(items, currentItem, openForView);
 */
export function usePluginNavigation<T extends { id: string }>(
  items: T[],
  currentItem: T | null,
  openForView: (item: T) => void,
) {
  const rawIndex = currentItem ? items.findIndex((item) => item.id === currentItem.id) : -1;
  const totalItems = items.length;
  const hasPrevItem = rawIndex > 0;
  const hasNextItem = rawIndex >= 0 && rawIndex < totalItems - 1;

  const navigateToPrevItem = useCallback(() => {
    if (!hasPrevItem || rawIndex <= 0) {
      return;
    }
    const prev = items[rawIndex - 1];
    if (prev) {
      openForView(prev);
    }
  }, [hasPrevItem, rawIndex, items, openForView]);

  const navigateToNextItem = useCallback(() => {
    if (!hasNextItem || rawIndex < 0 || rawIndex >= items.length - 1) {
      return;
    }
    const next = items[rawIndex + 1];
    if (next) {
      openForView(next);
    }
  }, [hasNextItem, rawIndex, items, openForView]);

  return {
    navigateToPrevItem,
    navigateToNextItem,
    hasPrevItem,
    hasNextItem,
    currentItemIndex: rawIndex === -1 ? 0 : rawIndex + 1,
    totalItems,
  };
}
