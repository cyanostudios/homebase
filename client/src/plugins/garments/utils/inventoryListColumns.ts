import type {
  GarmentCheckboxColumn,
  GarmentList,
  GarmentPerson,
  InventoryItem,
} from '../types/garments';

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
    if (col.hidden === true) {
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

/**
 * Whether a person has any filled data for an assigned inventory article
 * (size, audience, or any of that article’s status checkboxes).
 */
export function personHasFilledInventoryItem(
  person: Pick<GarmentPerson, 'checkboxValues' | 'ctSizes' | 'ctAudiences'>,
  itemId: string,
  groupColumns: GarmentCheckboxColumn[],
): boolean {
  const id = String(itemId);
  if (person.ctSizes?.[id]?.trim()) {
    return true;
  }
  if (person.ctAudiences?.[id]?.trim()) {
    return true;
  }
  for (const col of groupColumns) {
    if (person.checkboxValues?.[col.id]) {
      return true;
    }
  }
  return false;
}

/** Size/audience only — ignores Ordered / Delivered / Handed out. */
export function personHasInventoryFitData(
  person: Pick<GarmentPerson, 'ctSizes' | 'ctAudiences'>,
  itemId: string,
): boolean {
  const id = String(itemId);
  return Boolean(person.ctSizes?.[id]?.trim() || person.ctAudiences?.[id]?.trim());
}

export type GarmentFitSummaryBreakdown = {
  audience: string;
  size: string;
  count: number;
};

export type GarmentFitSummaryEntry = {
  itemId: string;
  articleName: string;
  personCount: number;
  /** Persons with size and/or audience for this inventory item. */
  filledCount: number;
  /** Audience + size combinations (e.g. Women / M — 2). */
  fitBreakdowns: GarmentFitSummaryBreakdown[];
};

function compareFitBreakdown(a: GarmentFitSummaryBreakdown, b: GarmentFitSummaryBreakdown): number {
  const audienceCompare = a.audience.localeCompare(b.audience, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
  if (audienceCompare !== 0) {
    return audienceCompare;
  }
  return a.size.localeCompare(b.size, undefined, { numeric: true, sensitivity: 'base' });
}

function fitBreakdownKey(audience: string, size: string): string {
  return `${audience}\0${size}`;
}

/**
 * Per assigned inventory article: how many persons have size/audience filled,
 * plus audience+size breakdowns. Status checkboxes are ignored.
 * Articles with no filled counts are omitted.
 */
export function buildGarmentListFitSummary(
  persons: Array<Pick<GarmentPerson, 'ctSizes' | 'ctAudiences'>>,
  garmentGroups: Array<{ group: string; columns: GarmentCheckboxColumn[] }>,
  inventoryItems: InventoryItem[],
): GarmentFitSummaryEntry[] {
  const personCount = persons.length;
  const entries: GarmentFitSummaryEntry[] = [];
  const seenItemIds = new Set<string>();

  for (const { group, columns: groupCols } of garmentGroups) {
    const itemId = inventoryItemIdFromGroupColumns(groupCols);
    if (!itemId || seenItemIds.has(itemId)) {
      continue;
    }
    seenItemIds.add(itemId);

    const inventoryItem = inventoryItems.find((item) => String(item.id) === itemId);
    const articleName = inventoryItem?.articleName?.trim() || group.trim() || itemId;

    const breakdownMap = new Map<string, GarmentFitSummaryBreakdown>();
    let filledCount = 0;

    for (const person of persons) {
      const size = person.ctSizes?.[itemId]?.trim() ?? '';
      const audience = person.ctAudiences?.[itemId]?.trim() ?? '';
      if (!size && !audience) {
        continue;
      }
      filledCount += 1;
      const key = fitBreakdownKey(audience, size);
      const existing = breakdownMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        breakdownMap.set(key, { audience, size, count: 1 });
      }
    }

    if (filledCount === 0) {
      continue;
    }

    entries.push({
      itemId,
      articleName,
      personCount,
      filledCount,
      fitBreakdowns: Array.from(breakdownMap.values()).sort(compareFitBreakdown),
    });
  }

  return entries;
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
