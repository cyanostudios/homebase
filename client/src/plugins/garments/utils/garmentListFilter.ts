import type { GarmentList, InventoryItem } from '../types/garments';

export function garmentListMatchesSearch(list: GarmentList, searchTerm: string): boolean {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return list.name.toLowerCase().includes(needle) || String(list.id).toLowerCase().includes(needle);
}

export function inventoryItemMatchesSearch(item: InventoryItem, searchTerm: string): boolean {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  if (
    item.articleName.toLowerCase().includes(needle) ||
    item.brand.toLowerCase().includes(needle) ||
    (item.material || '').toLowerCase().includes(needle) ||
    (item.description || '').toLowerCase().includes(needle) ||
    (item.comment || '').toLowerCase().includes(needle) ||
    String(item.id).toLowerCase().includes(needle)
  ) {
    return true;
  }
  return (item.variants || []).some(
    (variant) =>
      (variant.sku || '').toLowerCase().includes(needle) ||
      (variant.color || '').toLowerCase().includes(needle) ||
      (variant.size || '').toLowerCase().includes(needle),
  );
}

/** Overlay in-progress jersey edit so duplicate warnings update before Save. */
export function personsWithEditingJersey(
  persons: Array<{ id: string; jerseyNumber: string | null }>,
  editingId: string | null,
  editingJersey: string | null | undefined,
): Array<{ id: string; jerseyNumber: string | null }> {
  if (!editingId) {
    return persons;
  }
  return persons.map((person) =>
    person.id === editingId
      ? { id: person.id, jerseyNumber: editingJersey ?? person.jerseyNumber }
      : person,
  );
}

/** Soft (non-blocking) duplicate jersey detection within a list. */
export function findDuplicateJerseyNumbers(
  persons: Array<{ id: string; jerseyNumber: string | null }>,
): Set<string> {
  const counts = new Map<string, string[]>();
  for (const person of persons) {
    const num = (person.jerseyNumber ?? '').trim();
    if (!num) {
      continue;
    }
    const key = num.toLowerCase();
    const ids = counts.get(key) ?? [];
    ids.push(person.id);
    counts.set(key, ids);
  }
  const duplicateIds = new Set<string>();
  for (const ids of counts.values()) {
    if (ids.length > 1) {
      ids.forEach((id) => duplicateIds.add(id));
    }
  }
  return duplicateIds;
}

/** Toggle one checkbox key; missing keys start as false → true. */
export function toggleCheckboxValue(
  values: Record<string, boolean> | undefined,
  columnId: string,
): Record<string, boolean> {
  return {
    ...(values ?? {}),
    [columnId]: !values?.[columnId],
  };
}

/** Set many checkbox keys to the same boolean (master row → all garments). */
export function setCheckboxValuesForIds(
  values: Record<string, boolean> | undefined,
  columnIds: string[],
  checked: boolean,
): Record<string, boolean> {
  const next = { ...(values ?? {}) };
  for (const id of columnIds) {
    next[id] = checked;
  }
  return next;
}

/** Master checkbox state for a status across garment groups. */
export function getMasterCheckboxState(
  values: Record<string, boolean> | undefined,
  columnIds: string[],
): { checked: boolean; indeterminate: boolean } {
  if (columnIds.length === 0) {
    return { checked: false, indeterminate: false };
  }
  const filled = columnIds.filter((id) => Boolean(values?.[id])).length;
  if (filled === 0) {
    return { checked: false, indeterminate: false };
  }
  if (filled === columnIds.length) {
    return { checked: true, indeterminate: false };
  }
  return { checked: false, indeterminate: true };
}

export type PersonCompletionStatus = 'empty' | 'partial' | 'complete';

/**
 * Traffic-light completion for a person row:
 * - empty: nothing filled → red
 * - partial: some fields/checkboxes filled → amber
 * - complete: jersey name, initials, and all list checkbox columns filled → green
 */
export function getPersonCompletionStatus(input: {
  jerseyName?: string | null;
  initials?: string | null;
  checkboxValues?: Record<string, boolean>;
  checkboxColumnIds: string[];
}): PersonCompletionStatus {
  const checks: boolean[] = [
    Boolean((input.jerseyName ?? '').trim()),
    Boolean((input.initials ?? '').trim()),
    ...input.checkboxColumnIds.map((id) => Boolean(input.checkboxValues?.[id])),
  ];
  if (checks.length === 0) {
    return 'empty';
  }
  const filled = checks.filter(Boolean).length;
  if (filled === 0) {
    return 'empty';
  }
  if (filled === checks.length) {
    return 'complete';
  }
  return 'partial';
}

export function personCompletionDotClass(status: PersonCompletionStatus): string {
  if (status === 'complete') {
    return 'bg-emerald-500';
  }
  if (status === 'partial') {
    return 'bg-amber-500';
  }
  return 'bg-red-500';
}
