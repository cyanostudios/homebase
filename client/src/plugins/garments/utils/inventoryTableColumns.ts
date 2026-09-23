/** Inventory list shows article name only; brand/qty/price live in identity meta under the name. */
export const INVENTORY_TABLE_COLUMN_IDS = ['articleName'] as const;

export type InventoryTableColumnId = (typeof INVENTORY_TABLE_COLUMN_IDS)[number];

/** Always articleName — table column prefs were removed from inventory settings. */
export const resolveVisibleInventoryTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): InventoryTableColumnId[] => ['articleName'];
