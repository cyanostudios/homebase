export type ListViewMode = 'cards' | 'table';

export function isListViewMode(value: unknown): value is ListViewMode {
  return value === 'cards' || value === 'table';
}

/** Prefer listViewMode. Never treat legacy viewMode (grid/list) as table. Default cards. */
export function resolveListViewMode(
  settings:
    | {
        listViewMode?: unknown;
      }
    | null
    | undefined,
): ListViewMode {
  if (isListViewMode(settings?.listViewMode)) {
    return settings.listViewMode;
  }
  return 'cards';
}

export function parseStoredListViewMode(raw: string | null): ListViewMode | null {
  if (raw === null || raw === '') {
    return null;
  }
  return isListViewMode(raw) ? raw : null;
}

export function getInitialListViewMode(storageKey: string): ListViewMode {
  if (typeof window === 'undefined') {
    return 'cards';
  }
  const fromStorage = parseStoredListViewMode(window.sessionStorage.getItem(storageKey));
  return fromStorage ?? 'cards';
}

export function persistListViewModeSession(storageKey: string, mode: ListViewMode): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.sessionStorage.setItem(storageKey, mode);
}

/** Header-click sort: toggle order on same field, else switch field with plugin default order. */
export function nextListTableSort<TField extends string>(
  currentField: TField,
  currentOrder: 'asc' | 'desc',
  nextField: TField,
  isAscDefault: (field: TField) => boolean,
): { field: TField; order: 'asc' | 'desc' } {
  if (currentField === nextField) {
    return { field: currentField, order: currentOrder === 'asc' ? 'desc' : 'asc' };
  }
  return {
    field: nextField,
    order: isAscDefault(nextField) ? 'asc' : 'desc',
  };
}
