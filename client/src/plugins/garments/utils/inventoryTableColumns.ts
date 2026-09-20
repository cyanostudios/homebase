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
  defaultHidden: ['tags', 'material', 'salePrice', 'createdAt', 'updatedAt'],
});

export const DEFAULT_INVENTORY_TABLE_COLUMNS = helpers.DEFAULT;
export const isInventoryTableColumnId = helpers.isColumnId;
export const normalizeInventoryTableColumns = helpers.normalize;
export const resolveVisibleInventoryTableColumns = helpers.resolveVisible;
export const inventoryTableColumnsEqual = helpers.equal;
export const reorderInventoryTableColumns = helpers.reorder;
export const setInventoryTableColumnHidden = helpers.setHidden;
export type InventoryTableColumnsPref = ReturnType<typeof helpers.normalize>;
