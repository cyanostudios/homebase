import {
  countInventoryItemsWithTag,
  inventoryItemMatchesSearch,
  inventoryItemMatchesSelectedTags,
  inventoryItemMatchesTagFilter,
  inventoryItemVisibleInCatalog,
  toggleInventoryTagFilter,
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

describe('inventoryItemMatchesSelectedTags', () => {
  it('matches all when selection is empty', () => {
    const item = baseItem({ tags: ['Home'] });
    expect(inventoryItemMatchesSelectedTags(item, [])).toBe(true);
  });

  it('OR-matches any selected tag case-insensitively', () => {
    const item = baseItem({ tags: ['Home'] });
    expect(inventoryItemMatchesSelectedTags(item, ['home', 'Away'])).toBe(true);
    expect(inventoryItemMatchesSelectedTags(item, ['Away', 'Training'])).toBe(false);
  });
});

describe('toggleInventoryTagFilter', () => {
  it('adds and removes tags from multi-select', () => {
    expect(toggleInventoryTagFilter([], 'A')).toEqual(['A']);
    expect(toggleInventoryTagFilter(['A'], 'B')).toEqual(['A', 'B']);
    expect(toggleInventoryTagFilter(['A', 'B'], 'A')).toEqual(['B']);
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

describe('inventoryItemVisibleInCatalog', () => {
  it('hides archived articles in the active catalog until search matches', () => {
    const active = baseItem({ id: '1' });
    const archived = baseItem({ id: '2', articleName: 'Old sauce', archivedAt: '2026-01-01' });
    expect(inventoryItemVisibleInCatalog(active, { archivedOnly: false, searchTerm: '' })).toBe(
      true,
    );
    expect(inventoryItemVisibleInCatalog(archived, { archivedOnly: false, searchTerm: '' })).toBe(
      false,
    );
    expect(
      inventoryItemVisibleInCatalog(archived, { archivedOnly: false, searchTerm: 'sauce' }),
    ).toBe(true);
    expect(inventoryItemVisibleInCatalog(archived, { archivedOnly: true, searchTerm: '' })).toBe(
      true,
    );
    expect(inventoryItemVisibleInCatalog(active, { archivedOnly: true, searchTerm: '' })).toBe(
      false,
    );
  });
});

describe('inventoryItemMatchesSearch', () => {
  it('matches tag text', () => {
    const item = baseItem({ tags: ['Match kit'] });
    expect(inventoryItemMatchesSearch(item, 'kit')).toBe(true);
    expect(inventoryItemMatchesSearch(item, 'training')).toBe(false);
  });
});
