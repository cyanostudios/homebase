import type { GarmentCheckboxColumn, GarmentList, InventoryItem } from '../types/garments';

/** Hidden from matrix — legacy person-level column. */
export const HIDDEN_PERSON_COLUMN_IDS = new Set(['person_blankett_fogis']);

const INVENTORY_STATUS_COLUMNS = [
  { suffix: 'ordered', label: 'Ordered' },
  { suffix: 'delivered', label: 'Delivered' },
  { suffix: 'handed_out', label: 'Handed out' },
] as const;

/** Extract inventory item id from checkbox column id (`inv_{id}_ordered`). */
export function inventoryItemIdFromColumnId(columnId: string): string | null {
  const match = columnId.match(/^inv_(\d+)_/);
  return match ? match[1] : null;
}

export function inventoryItemIdFromGroupColumns(columns: GarmentCheckboxColumn[]): string | null {
  for (const col of columns) {
    const itemId = inventoryItemIdFromColumnId(col.id);
    if (itemId) return itemId;
  }
  return null;
}

/** Assigned ids from API, or inferred from inv_* columns when API field is missing. */
export function effectiveAssignedInventoryIds(
  columns: GarmentCheckboxColumn[],
  assignedInventoryItemIds?: string[],
): string[] {
  const fromApi = (assignedInventoryItemIds ?? []).map(String).filter(Boolean);
  if (fromApi.length) {
    return fromApi;
  }
  const fromColumns = new Set<string>();
  for (const col of columns) {
    const itemId = inventoryItemIdFromColumnId(col.id);
    if (itemId) {
      fromColumns.add(itemId);
    }
  }
  return Array.from(fromColumns);
}

/**
 * Keep Paid + assigned inventory columns only (drop Fogis and legacy Shorts/Shirt/Socks groups).
 */
export function filterMatrixColumns(
  columns: GarmentCheckboxColumn[],
  assignedInventoryItemIds?: string[],
): GarmentCheckboxColumn[] {
  const assigned = new Set(effectiveAssignedInventoryIds(columns, assignedInventoryItemIds));
  return columns.filter((col) => {
    if (HIDDEN_PERSON_COLUMN_IDS.has(col.id)) {
      return false;
    }
    const group = col.group?.trim();
    if (!group) {
      return true;
    }
    const itemId = inventoryItemIdFromColumnId(col.id);
    return Boolean(itemId && assigned.has(itemId));
  });
}

function buildColumnsForInventoryItem(
  item: InventoryItem,
  startSortOrder: number,
): GarmentCheckboxColumn[] {
  return INVENTORY_STATUS_COLUMNS.map((status, index) => ({
    id: `inv_${item.id}_${status.suffix}`,
    label: status.label,
    group: item.articleName,
    sortOrder: startSortOrder + index,
  }));
}

/**
 * Visible matrix columns: filtered list columns + synthetic inv_* columns for assigned items
 * when checkbox_columns are out of sync with Settings assignments.
 */
export function resolveMatrixColumns(
  list: GarmentList,
  inventoryItems: InventoryItem[],
): GarmentCheckboxColumn[] {
  const sorted = [...(list.checkboxColumns ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const assignedIds = effectiveAssignedInventoryIds(sorted, list.assignedInventoryItemIds);
  let filtered = filterMatrixColumns(sorted, assignedIds);

  const coveredIds = new Set<string>();
  for (const col of filtered) {
    const itemId = inventoryItemIdFromColumnId(col.id);
    if (itemId) {
      coveredIds.add(itemId);
    }
  }

  let maxSort = filtered.reduce((max, col) => Math.max(max, col.sortOrder ?? 0), -1);
  for (const itemId of assignedIds) {
    if (coveredIds.has(itemId)) {
      continue;
    }
    const item = inventoryItems.find((entry) => String(entry.id) === itemId);
    if (!item) {
      continue;
    }
    maxSort += 1;
    const built = buildColumnsForInventoryItem(item, maxSort);
    filtered = [...filtered, ...built];
    maxSort += built.length - 1;
  }

  return filtered.sort((a, b) => a.sortOrder - b.sortOrder);
}

/** Unique non-empty audiences from inventory variants. */
export function inventoryItemAudiences(item: InventoryItem | undefined): string[] {
  if (!item?.variants?.length) return [];
  const seen = new Set<string>();
  const audiences: string[] = [];
  for (const variant of item.variants) {
    const audience = variant.audience?.trim();
    if (!audience || seen.has(audience)) continue;
    seen.add(audience);
    audiences.push(audience);
  }
  return audiences;
}

/** Unique non-empty sizes from inventory variants (all audiences). */
export function inventoryItemSizes(item: InventoryItem | undefined): string[] {
  if (!item?.variants?.length) return [];
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const variant of item.variants) {
    const size = variant.size?.trim();
    if (!size || seen.has(size)) continue;
    seen.add(size);
    sizes.push(size);
  }
  return sizes;
}

/** Sizes for one audience; empty audience matches variants with blank audience. */
export function inventoryItemSizesForAudience(
  item: InventoryItem | undefined,
  audience: string,
): string[] {
  if (!item?.variants?.length) return [];
  const normalizedAudience = audience.trim();
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const variant of item.variants) {
    const variantAudience = variant.audience?.trim() ?? '';
    if (variantAudience !== normalizedAudience) continue;
    const size = variant.size?.trim();
    if (!size || seen.has(size)) continue;
    seen.add(size);
    sizes.push(size);
  }
  return sizes;
}
