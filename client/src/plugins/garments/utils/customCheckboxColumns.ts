import type { GarmentCheckboxColumn } from '../types/garments';

export const PAID_COLUMN_ID = 'person_betalt';

/** Matches backend `checkboxColumns` max (routes.js). */
export const MAX_CHECKBOX_COLUMNS = 50;

const INVENTORY_STATUS_COLUMN_RE = /^inv_\d+_(ordered|delivered|handed_out)$/;
const LEGACY_GROUP_COLUMN_RE = /^(shorts|troja|strumpor)_(bestallt|levererat|utdelat)$/;
const CUSTOM_COLUMN_PREFIX = 'custom_';

const SYSTEM_PERSON_COLUMN_IDS = new Set([PAID_COLUMN_ID, 'person_blankett_fogis']);

export function isInventoryStatusColumnId(id: string): boolean {
  return INVENTORY_STATUS_COLUMN_RE.test(id);
}

export function isSystemCheckboxColumnId(id: string): boolean {
  if (SYSTEM_PERSON_COLUMN_IDS.has(id)) {
    return true;
  }
  if (isInventoryStatusColumnId(id)) {
    return true;
  }
  return LEGACY_GROUP_COLUMN_RE.test(id);
}

export function isCustomCheckboxColumnId(id: string): boolean {
  return id.startsWith(CUSTOM_COLUMN_PREFIX);
}

function newCustomColumnId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${CUSTOM_COLUMN_PREFIX}${crypto.randomUUID()}`;
  }
  return `${CUSTOM_COLUMN_PREFIX}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createCustomCheckboxColumn(
  label: string,
  sortOrder: number,
): GarmentCheckboxColumn {
  return {
    id: newCustomColumnId(),
    label: label.trim(),
    sortOrder,
  };
}

/** Paid + custom_* person-level columns (editable in list settings). Excludes Fogis.
 * Does not re-insert Paid if the list removed it — Paid is only a create-list default.
 */
export function listEditablePersonCheckboxColumns(
  columns: GarmentCheckboxColumn[],
): GarmentCheckboxColumn[] {
  return columns
    .filter((col) => {
      if (col.group?.trim()) {
        return false;
      }
      return col.id === PAID_COLUMN_ID || isCustomCheckboxColumnId(col.id);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((col, index) => ({ ...col, sortOrder: index }));
}

export function listCustomCheckboxColumns(
  columns: GarmentCheckboxColumn[],
): GarmentCheckboxColumn[] {
  return columns
    .filter((col) => isCustomCheckboxColumnId(col.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/** True when the column can be permanently removed from list settings (Paid or custom_*). */
export function isRemovablePersonCheckboxColumnId(id: string): boolean {
  return id === PAID_COLUMN_ID || isCustomCheckboxColumnId(id);
}

/**
 * Re-adds the default Paid column when missing (e.g. after delete). Preserves other columns.
 */
export function addPaidCheckboxColumn(columns: GarmentCheckboxColumn[]): GarmentCheckboxColumn[] {
  if (columns.some((col) => col.id === PAID_COLUMN_ID)) {
    return columns;
  }
  if (columns.length >= MAX_CHECKBOX_COLUMNS) {
    throw new Error('MAX_CHECKBOX_COLUMNS');
  }
  const paid: GarmentCheckboxColumn = { id: PAID_COLUMN_ID, label: 'Paid', sortOrder: 0 };
  return [paid, ...columns.map((col, index) => ({ ...col, sortOrder: index + 1 }))];
}

export function reorderPersonCheckboxColumnIds(
  order: string[],
  sourceId: string,
  targetId: string,
): string[] {
  if (sourceId === targetId) {
    return order;
  }
  const from = order.indexOf(sourceId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0) {
    return order;
  }
  const next = [...order];
  next.splice(from, 1);
  next.splice(to, 0, sourceId);
  return next;
}

export function setPersonCheckboxColumnHidden(
  columns: GarmentCheckboxColumn[],
  columnId: string,
  hidden: boolean,
): GarmentCheckboxColumn[] {
  if (columnId !== PAID_COLUMN_ID && !isCustomCheckboxColumnId(columnId)) {
    return columns;
  }
  return columns.map((col) => {
    if (col.id !== columnId) {
      return col;
    }
    if (hidden) {
      return { ...col, hidden: true };
    }
    const { hidden: _removed, ...rest } = col;
    return rest;
  });
}

/**
 * Appends a person-level custom column. Preserves all existing (including system) columns.
 * Returns the same array when label is empty. Throws when at the 50-column cap.
 */
export function addCustomCheckboxColumn(
  columns: GarmentCheckboxColumn[],
  label: string,
): GarmentCheckboxColumn[] {
  const trimmed = label.trim();
  if (!trimmed) {
    return columns;
  }
  if (columns.length >= MAX_CHECKBOX_COLUMNS) {
    throw new Error('MAX_CHECKBOX_COLUMNS');
  }
  const maxSort = columns.reduce((max, col) => Math.max(max, col.sortOrder ?? 0), -1);
  return [...columns, createCustomCheckboxColumn(trimmed, maxSort + 1)];
}

/**
 * Renames a custom column. No-op for system / unknown ids (never drops columns).
 */
export function renameCustomCheckboxColumn(
  columns: GarmentCheckboxColumn[],
  id: string,
  label: string,
): GarmentCheckboxColumn[] {
  if (!isCustomCheckboxColumnId(id)) {
    return columns;
  }
  const trimmed = label.trim();
  if (!trimmed) {
    return columns;
  }
  return columns.map((col) => (col.id === id ? { ...col, label: trimmed } : col));
}

/**
 * Removes Paid or a custom_* column. No-op for inventory / legacy / Fogis ids.
 */
export function removeCustomCheckboxColumn(
  columns: GarmentCheckboxColumn[],
  id: string,
): GarmentCheckboxColumn[] {
  if (!isRemovablePersonCheckboxColumnId(id)) {
    return columns;
  }
  return columns.filter((col) => col.id !== id);
}

/**
 * Merges editable person-column draft back into the full checkboxColumns array.
 * Preserves inventory / legacy / Fogis columns; never drops them.
 */
export function applyPersonCheckboxColumnDraft(
  allColumns: GarmentCheckboxColumn[],
  draftPersonColumns: GarmentCheckboxColumn[],
): GarmentCheckboxColumn[] {
  const draftIds = new Set(draftPersonColumns.map((col) => col.id));
  const retained = allColumns.filter((col) => {
    if (col.group?.trim()) {
      return true;
    }
    if (col.id === PAID_COLUMN_ID || isCustomCheckboxColumnId(col.id)) {
      return false;
    }
    return !draftIds.has(col.id);
  });

  const persons = draftPersonColumns.map((col, index) => {
    const next: GarmentCheckboxColumn = {
      id: col.id,
      label: col.label,
      sortOrder: index,
    };
    if (col.hidden === true && (col.id === PAID_COLUMN_ID || isCustomCheckboxColumnId(col.id))) {
      next.hidden = true;
    }
    return next;
  });

  return [
    ...persons,
    ...retained.map((col, index) => ({
      ...col,
      sortOrder: persons.length + index,
    })),
  ];
}

export function personCheckboxColumnsEqual(
  a: GarmentCheckboxColumn[],
  b: GarmentCheckboxColumn[],
): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((col, index) => {
    const other = b[index];
    return (
      col.id === other.id &&
      col.label === other.label &&
      Boolean(col.hidden) === Boolean(other.hidden) &&
      col.sortOrder === other.sortOrder
    );
  });
}
