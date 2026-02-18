// client/src/core/hooks/useBulkSelection.ts
// Generic bulk selection state management hook for all plugins

import { useState, useMemo, useCallback } from 'react';

export interface UseBulkSelectionReturn {
  selectedIds: string[];
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  selectedCount: number;
}

/**
 * Hook for managing bulk selection state in list components.
 */
export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  const toggleSelection = useCallback((id: string) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    const normalized = Array.isArray(ids) ? ids.map(String) : [];
    setSelectedIds(normalized);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const isSelected = useCallback(
    (id: string) => {
      return selectedIds.includes(String(id));
    },
    [selectedIds],
  );

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    selectedCount,
  };
}
