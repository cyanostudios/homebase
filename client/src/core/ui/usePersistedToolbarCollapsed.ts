import { useCallback, useState } from 'react';

import { readListToolbarCollapsed, writeListToolbarCollapsed } from '@/core/ui/listToolbarLayout';

/** Persist list-toolbar collapsed preference globally across all list views. Default: expanded. */
export function usePersistedToolbarCollapsed() {
  const [toolbarCollapsed, setToolbarCollapsedState] = useState(() => readListToolbarCollapsed());

  const setToolbarCollapsed = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setToolbarCollapsedState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      writeListToolbarCollapsed(value);
      return value;
    });
  }, []);

  const toggleToolbarCollapsed = useCallback(() => {
    setToolbarCollapsed((prev) => !prev);
  }, [setToolbarCollapsed]);

  return { toolbarCollapsed, setToolbarCollapsed, toggleToolbarCollapsed };
}
