// client/src/core/hooks/useShiftRangeListSelection.ts
// Shift+click range selection for list/grid row checkboxes (used across plugins).

import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';

export interface UseShiftRangeListSelectionOptions {
  /** Visible row ids in display order (filter + sort). */
  orderedVisibleIds: string[];
  mergeIntoSelection: (ids: string[]) => void;
  toggleOne: (id: string) => void;
}

export function useShiftRangeListSelection({
  orderedVisibleIds,
  mergeIntoSelection,
  toggleOne,
}: UseShiftRangeListSelectionOptions) {
  const lastAnchorIdRef = useRef<string | null>(null);
  const skipNextToggleForIdRef = useRef<string | null>(null);

  const handleRowCheckboxShiftMouseDown = useCallback(
    (e: ReactMouseEvent, index: number) => {
      if (!e.shiftKey && !e.nativeEvent.shiftKey) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const endId = orderedVisibleIds[index];
      const endKey = endId !== undefined && endId !== null ? String(endId) : null;
      if (endKey) {
        skipNextToggleForIdRef.current = endKey;
      }
      let anchorIdx = index;
      const anchorId = lastAnchorIdRef.current;
      if (anchorId) {
        const found = orderedVisibleIds.findIndex((id) => String(id) === String(anchorId));
        if (found >= 0) {
          anchorIdx = found;
        }
      }
      const lo = Math.min(anchorIdx, index);
      const hi = Math.max(anchorIdx, index);
      mergeIntoSelection(orderedVisibleIds.slice(lo, hi + 1));
      lastAnchorIdRef.current = endKey;
    },
    [orderedVisibleIds, mergeIntoSelection],
  );

  const onVisibleRowCheckboxChange = useCallback(
    (id: string) => {
      const key = String(id);
      if (skipNextToggleForIdRef.current === key) {
        skipNextToggleForIdRef.current = null;
        lastAnchorIdRef.current = key;
        return;
      }
      toggleOne(id);
      lastAnchorIdRef.current = key;
    },
    [toggleOne],
  );

  return { handleRowCheckboxShiftMouseDown, onVisibleRowCheckboxChange };
}
