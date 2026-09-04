import { useCallback, useState } from 'react';

/** Survives list unmount (full view/edit) and plugin switches. */
const persistedListSearch = new Map<string, string>();

export function getPersistedListSearch(key: string): string {
  return persistedListSearch.get(key) ?? '';
}

export function setPersistedListSearch(key: string, value: string): void {
  persistedListSearch.set(key, value);
}

export function usePersistedListSearch(key: string) {
  const [searchTerm, setSearchTermState] = useState(() => getPersistedListSearch(key));

  const setSearchTerm = useCallback(
    (value: string) => {
      setPersistedListSearch(key, value);
      setSearchTermState(value);
    },
    [key],
  );

  return { searchTerm, setSearchTerm };
}
