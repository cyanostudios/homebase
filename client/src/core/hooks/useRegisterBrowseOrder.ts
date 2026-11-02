import { useEffect, useRef } from 'react';

/**
 * Keeps plugin prev/next navigation aligned with the visible list order.
 * Call from `*List.tsx` with the same ordered IDs used for rendering / shift-select.
 *
 * Depends on ID *content*, not array identity — list memos often rebuild the
 * same IDs each render, and a naive effect + setState loops (max update depth).
 */
export function useRegisterBrowseOrder(
  setBrowseOrderIds: (ids: string[]) => void,
  orderedIds: string[],
): void {
  const idsRef = useRef(orderedIds);
  idsRef.current = orderedIds;
  const orderKey = orderedIds.join('\0');

  useEffect(() => {
    setBrowseOrderIds(idsRef.current);
  }, [orderKey, setBrowseOrderIds]);
}
