import { useEffect } from 'react';

/**
 * Keeps plugin prev/next navigation aligned with the visible list order.
 * Call from `*List.tsx` with the same ordered IDs used for rendering / shift-select.
 */
export function useRegisterBrowseOrder(
  setBrowseOrderIds: (ids: string[]) => void,
  orderedIds: string[],
): void {
  useEffect(() => {
    setBrowseOrderIds(orderedIds);
  }, [orderedIds, setBrowseOrderIds]);
}
