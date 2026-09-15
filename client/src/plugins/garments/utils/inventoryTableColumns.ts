import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const INVENTORY_TABLE_COLUMN_IDS = [
  'articleName',
  'brand',
  'tags',
  'variantCount',
  'totalQuantity',
  'material',
  'salePrice',
  'createdAt',
  'updatedAt',
] as const;

export type InventoryTableColumnId = (typeof INVENTORY_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: INVENTORY_TABLE_COLUMN_IDS,
  requiredColumnId: 'articleName',
  /** Name-only list default; per-plugin metadata columns come later in code. */
  defaultHidden: [
    'brand',
    'tags',
    'variantCount',
    'totalQuantity',
    'material',
    'salePrice',
    'createdAt',
    'updatedAt',
  ],
});

export const DEFAULT_INVENTORY_TABLE_COLUMNS = helpers.DEFAULT;
export const isInventoryTableColumnId = helpers.isColumnId;
export const normalizeInventoryTableColumns = helpers.normalize;
/** Always code defaults — table column prefs were removed from settings. */
export const resolveVisibleInventoryTableColumns = (
  _settings?: { tableColumns?: unknown } | null,
): InventoryTableColumnId[] => helpers.resolveVisible(null);
export const inventoryTableColumnsEqual = helpers.equal;
export const reorderInventoryTableColumns = helpers.reorder;
export const setInventoryTableColumnHidden = helpers.setHidden;
export type InventoryTableColumnsPref = ReturnType<typeof helpers.normalize>;
