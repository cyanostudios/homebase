import { useEffect, useRef, useState } from 'react';

import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Module-scoped pending IDs so list remount after closing full view can restore preview. */
const pendingByStoreKey = new Map<string, string | null>();

export function setPendingQuickContextId(storeKey: string, id: string | null): void {
  pendingByStoreKey.set(storeKey, id);
}

export function getPendingQuickContextId(storeKey: string): string | null {
  return pendingByStoreKey.get(storeKey) ?? null;
}

export function clearPendingQuickContextId(storeKey: string): void {
  pendingByStoreKey.set(storeKey, null);
}

export interface UseQuickContextPreviewOptions<T> {
  /** Unique key per plugin (e.g. `'tasks'`) for pending-restore store. */
  storeKey: string;
  /** Current list items used to sync / restore the preview. */
  items: T[];
  getItemId: (item: T) => string;
}

export interface UseQuickContextPreviewReturn<T> {
  previewItem: T | null;
  setPreviewItem: React.Dispatch<React.SetStateAction<T | null>>;
  isCompactViewport: boolean;
  showQuickContext: boolean;
  /** Remember id then open full view so closing restores the panel. */
  markPendingAndOpen: (item: T, open: () => void) => void;
  /** Desktop: set preview; compact: open full view via `openForView`. */
  activateRow: (item: T, openForView: (item: T) => void) => void;
}

/**
 * Shared list quick-context preview state.
 * Desktop row click opens a sticky side panel; compact viewports open full view.
 * Bulk selection stays available while the panel is open.
 */
export function useQuickContextPreview<T>({
  storeKey,
  items,
  getItemId,
}: UseQuickContextPreviewOptions<T>): UseQuickContextPreviewReturn<T> {
  const isCompactViewport = useMediaQuery('(max-width: 1023px)');
  const [previewItem, setPreviewItem] = useState<T | null>(null);
  const restoredPendingRef = useRef(false);

  useEffect(() => {
    if (restoredPendingRef.current) {
      return;
    }
    const pendingId = getPendingQuickContextId(storeKey);
    if (!pendingId) {
      return;
    }
    const restored = items.find((item) => getItemId(item) === pendingId);
    if (restored) {
      setPreviewItem(restored);
      restoredPendingRef.current = true;
      clearPendingQuickContextId(storeKey);
    }
  }, [items, storeKey, getItemId]);

  useEffect(() => {
    if (!previewItem) {
      return;
    }
    const previewId = getItemId(previewItem);
    const next = items.find((item) => getItemId(item) === previewId);
    if (!next) {
      setPreviewItem(null);
      return;
    }
    if (next !== previewItem) {
      setPreviewItem(next);
    }
  }, [items, previewItem, getItemId]);

  const showQuickContext = Boolean(previewItem) && !isCompactViewport;

  const markPendingAndOpen = (item: T, open: () => void) => {
    setPendingQuickContextId(storeKey, getItemId(item));
    open();
  };

  const activateRow = (item: T, openForView: (item: T) => void) => {
    if (isCompactViewport) {
      markPendingAndOpen(item, () => openForView(item));
      return;
    }
    setPreviewItem(item);
  };

  return {
    previewItem,
    setPreviewItem,
    isCompactViewport,
    showQuickContext,
    markPendingAndOpen,
    activateRow,
  };
}
