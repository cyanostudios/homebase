import {
  filterMatrixColumns,
  inventoryItemAudiences,
  inventoryItemIdFromColumnId,
  inventoryItemIdFromGroupColumns,
  inventoryItemSizes,
  inventoryItemSizesForAudience,
  personHasFilledInventoryItem,
  resolveMatrixColumns,
} from '@/plugins/garments/utils/inventoryListColumns';
import type {
  GarmentCheckboxColumn,
  GarmentList,
  GarmentPerson,
  InventoryItem,
} from '@/plugins/garments/types/garments';

const sampleItem: InventoryItem = {
  id: '1',
  articleName: 'Shorts',
  brand: '',
  description: null,
  material: '',
  purchasePrice: null,
  recommendedPrice: null,
  salePrice: null,
  currency: 'SEK',
  comment: null,
  variants: [
    {
      id: '1',
      itemId: '1',
      sku: '',
      audience: 'Men',
      color: '',
      size: 'M',
      quantity: 1,
      sortOrder: 0,
    },
    {
      id: '2',
      itemId: '1',
      sku: '',
      audience: 'Men',
      color: '',
      size: 'L',
      quantity: 1,
      sortOrder: 1,
    },
    {
      id: '3',
      itemId: '1',
      sku: '',
      audience: 'Women',
      color: '',
      size: 'S',
      quantity: 1,
      sortOrder: 2,
    },
  ],
  totalQuantity: 3,
  variantCount: 3,
  createdAt: '',
  updatedAt: '',
};

describe('inventoryListColumns', () => {
  it('extracts inventory item id from column id', () => {
    expect(inventoryItemIdFromColumnId('inv_12_ordered')).toBe('12');
    expect(inventoryItemIdFromColumnId('shorts_bestallt')).toBeNull();
  });

  it('extracts inventory item id from group columns', () => {
    const columns: GarmentCheckboxColumn[] = [
      { id: 'inv_5_ordered', label: 'Ordered', group: 'Shorts', sortOrder: 0 },
      { id: 'inv_5_delivered', label: 'Delivered', group: 'Shorts', sortOrder: 1 },
    ];
    expect(inventoryItemIdFromGroupColumns(columns)).toBe('5');
  });

  it('filters matrix columns to assigned inventory and hides Fogis', () => {
    const columns: GarmentCheckboxColumn[] = [
      { id: 'person_betalt', label: 'Paid', sortOrder: 0 },
      { id: 'person_blankett_fogis', label: 'Fogis form', sortOrder: 1 },
      { id: 'shorts_bestallt', label: 'Ordered', group: 'Shorts', sortOrder: 2 },
      { id: 'inv_3_ordered', label: 'Ordered', group: 'Jacket', sortOrder: 3 },
      { id: 'inv_5_ordered', label: 'Ordered', group: 'Pants', sortOrder: 4 },
    ];
    expect(filterMatrixColumns(columns, ['3']).map((c) => c.id)).toEqual([
      'person_betalt',
      'inv_3_ordered',
    ]);
  });

  it('collects unique audiences and sizes per audience', () => {
    expect(inventoryItemAudiences(sampleItem)).toEqual(['Men', 'Women']);
    expect(inventoryItemSizes(sampleItem)).toEqual(['M', 'L', 'S']);
    expect(inventoryItemSizesForAudience(sampleItem, 'Men')).toEqual(['M', 'L']);
    expect(inventoryItemSizesForAudience(sampleItem, 'Women')).toEqual(['S']);
  });

  it('synthesizes inv_* columns for assigned items missing from checkbox_columns', () => {
    const list: GarmentList = {
      id: '1',
      name: 'F16',
      teamId: null,
      checkboxColumns: [{ id: 'person_betalt', label: 'Paid', sortOrder: 0 }],
      assignedInventoryItemIds: ['7'],
      createdAt: '',
      updatedAt: '',
    };
    const inventory: InventoryItem[] = [
      {
        ...sampleItem,
        id: '7',
        articleName: 'Shorts',
      },
    ];
    const resolved = resolveMatrixColumns(list, inventory);
    expect(resolved.map((c) => c.id)).toEqual([
      'person_betalt',
      'inv_7_ordered',
      'inv_7_delivered',
      'inv_7_handed_out',
    ]);
  });

  it('detects filled inventory data per person (size, audience, or status checkbox)', () => {
    const groupColumns: GarmentCheckboxColumn[] = [
      { id: 'inv_3_ordered', label: 'Ordered', group: 'Jacket', sortOrder: 0 },
      { id: 'inv_3_delivered', label: 'Delivered', group: 'Jacket', sortOrder: 1 },
      { id: 'inv_3_handed_out', label: 'Handed out', group: 'Jacket', sortOrder: 2 },
    ];
    const empty: GarmentPerson = {
      id: '1',
      listId: '1',
      name: 'Ada',
      shirtSize: null,
      shortsSize: null,
      socksSize: null,
      jerseyNumber: null,
      jerseyName: null,
      initials: null,
      comment: null,
      contactId: null,
      teamId: null,
      checkboxValues: {},
      ctSizes: {},
      ctAudiences: {},
      sortOrder: 0,
    };
    expect(personHasFilledInventoryItem(empty, '3', groupColumns)).toBe(false);
    expect(
      personHasFilledInventoryItem({ ...empty, ctSizes: { '3': 'M' } }, '3', groupColumns),
    ).toBe(true);
    expect(
      personHasFilledInventoryItem({ ...empty, ctAudiences: { '3': 'Men' } }, '3', groupColumns),
    ).toBe(true);
    expect(
      personHasFilledInventoryItem(
        { ...empty, checkboxValues: { inv_3_ordered: true } },
        '3',
        groupColumns,
      ),
    ).toBe(true);
    expect(
      personHasFilledInventoryItem(
        { ...empty, checkboxValues: { inv_9_ordered: true }, ctSizes: { '9': 'L' } },
        '3',
        groupColumns,
      ),
    ).toBe(false);
  });
});
