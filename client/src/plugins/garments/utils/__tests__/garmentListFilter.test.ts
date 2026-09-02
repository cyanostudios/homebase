import {
  countInventoryItemsWithTag,
  inventoryItemMatchesSearch,
  inventoryItemMatchesTagFilter,
} from '../garmentListFilter';
import type { InventoryItem } from '../../types/garments';

const baseItem = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: '1',
  articleName: 'Jersey',
  brand: 'Nike',
  description: null,
  material: '',
  purchasePrice: null,
  recommendedPrice: null,
  salePrice: null,
  currency: 'SEK',
  comment: null,
  tags: [],
  variants: [],
  totalQuantity: 0,
  variantCount: 0,
  createdAt: '',
  updatedAt: '',
  ...overrides,
});

describe('inventoryItemMatchesTagFilter', () => {
  it('matches all when filter is null or blank', () => {
    const item = baseItem({ tags: ['Home'] });
    expect(inventoryItemMatchesTagFilter(item, null)).toBe(true);
    expect(inventoryItemMatchesTagFilter(item, '  ')).toBe(true);
  });

  it('matches case-insensitively', () => {
    const item = baseItem({ tags: ['Home'] });
    expect(inventoryItemMatchesTagFilter(item, 'home')).toBe(true);
    expect(inventoryItemMatchesTagFilter(item, 'Away')).toBe(false);
  });
});

describe('countInventoryItemsWithTag', () => {
  it('counts items with the tag', () => {
    const items = [
      baseItem({ id: '1', tags: ['Home'] }),
      baseItem({ id: '2', tags: ['Away'] }),
      baseItem({ id: '3', tags: ['home', 'Training'] }),
    ];
    expect(countInventoryItemsWithTag(items, 'Home')).toBe(2);
    expect(countInventoryItemsWithTag(items, 'Training')).toBe(1);
  });
});

describe('inventoryItemMatchesSearch', () => {
  it('matches tag text', () => {
    const item = baseItem({ tags: ['Match kit'] });
    expect(inventoryItemMatchesSearch(item, 'kit')).toBe(true);
    expect(inventoryItemMatchesSearch(item, 'training')).toBe(false);
  });
});
