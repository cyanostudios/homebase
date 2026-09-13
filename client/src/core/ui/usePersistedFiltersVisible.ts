import { useCallback, useState } from 'react';

function readFiltersVisible(storageKey: string, defaultVisible: boolean): boolean {
  if (typeof window === 'undefined') {
    return defaultVisible;
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw === null) {
      return defaultVisible;
    }
    return raw === '1';
  } catch {
    return defaultVisible;
  }
}

function writeFiltersVisible(storageKey: string, visible: boolean): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(storageKey, visible ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
}

/** Persist show/hide of mail-toolbar filter chips across sessions. Default: visible. */
export function usePersistedFiltersVisible(storageKey: string, defaultVisible = true) {
  const [filtersVisible, setFiltersVisibleState] = useState(() =>
    readFiltersVisible(storageKey, defaultVisible),
  );

  const setFiltersVisible = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setFiltersVisibleState((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        writeFiltersVisible(storageKey, value);
        return value;
      });
    },
    [storageKey],
  );

  return { filtersVisible, setFiltersVisible };
}
