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
 * Hook for managing bulk selection state
 * Provides generic selection functionality for list components
 *
 * @returns {UseBulkSelectionReturn} Selection state and functions
 */
export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Computed selected count
  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

  // Toggle selection for a single item
  const toggleSelection = useCallback((id: string) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }, []);

  // Select all items from provided array
  const selectAll = useCallback((ids: string[]) => {
    const normalized = Array.isArray(ids) ? ids.map(String) : [];
    setSelectedIds(normalized);
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  // Check if an item is selected
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
