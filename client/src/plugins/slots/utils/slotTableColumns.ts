import { createTableColumnsHelpers } from '@/core/list/tableColumnsPref';

export const SLOT_TABLE_COLUMN_IDS = [
  'name',
  'category',
  'location',
  'slot_time',
  'visible',
  'booked_count',
  'created_at',
  'updated_at',
] as const;

export type SlotTableColumnId = (typeof SLOT_TABLE_COLUMN_IDS)[number];

const helpers = createTableColumnsHelpers({
  columnIds: SLOT_TABLE_COLUMN_IDS,
  requiredColumnId: 'name',
  defaultHidden: ['created_at', 'updated_at'],
});

export const DEFAULT_SLOT_TABLE_COLUMNS = helpers.DEFAULT;
export const isSlotTableColumnId = helpers.isColumnId;
export const normalizeSlotTableColumns = helpers.normalize;
export const resolveVisibleSlotTableColumns = helpers.resolveVisible;
export const slotTableColumnsEqual = helpers.equal;
export const reorderSlotTableColumns = helpers.reorder;
export const setSlotTableColumnHidden = helpers.setHidden;
export type SlotTableColumnsPref = ReturnType<typeof helpers.normalize>;
