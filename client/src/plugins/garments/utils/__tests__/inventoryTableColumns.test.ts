import {
  INVENTORY_TABLE_COLUMN_IDS,
  resolveVisibleInventoryTableColumns,
} from '../inventoryTableColumns';

describe('inventoryTableColumns', () => {
  it('resolves to articleName only and ignores legacy tableColumns prefs', () => {
    expect(INVENTORY_TABLE_COLUMN_IDS).toEqual(['articleName']);
    expect(resolveVisibleInventoryTableColumns(null)).toEqual(['articleName']);
    expect(
      resolveVisibleInventoryTableColumns({
        tableColumns: {
          order: ['articleName', 'brand', 'tags'],
          hidden: [],
        },
      }),
    ).toEqual(['articleName']);
  });
});
