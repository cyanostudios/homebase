import type { InventoryItem } from '../../types/garments';
import {
  buildInventoryTagsSavePayload,
  inventoryTagsEqual,
  mergeInventoryTag,
  normalizeInventoryTags,
  omitInventoryTag,
} from '../inventoryTags';

describe('normalizeInventoryTags', () => {
  it('trims, drops empties, and dedupes case-insensitively', () => {
    expect(normalizeInventoryTags(['  Home ', '', 'away', 'HOME', 12, null])).toEqual([
      'Home',
      'away',
    ]);
  });

  it('caps length', () => {
    const many = Array.from({ length: 60 }, (_, i) => `tag-${i}`);
    expect(normalizeInventoryTags(many, 5)).toHaveLength(5);
  });

  it('returns empty for non-arrays', () => {
    expect(normalizeInventoryTags(null)).toEqual([]);
    expect(normalizeInventoryTags('a')).toEqual([]);
  });
});

describe('inventoryTagsEqual', () => {
  it('compares ordered lists', () => {
    expect(inventoryTagsEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(inventoryTagsEqual(['a', 'b'], ['b', 'a'])).toBe(false);
  });
});

describe('mergeInventoryTag / omitInventoryTag', () => {
  it('merges case-insensitively', () => {
    expect(mergeInventoryTag(['Vip'], 'vip')).toEqual(['Vip']);
    expect(mergeInventoryTag(['a'], 'b')).toEqual(['a', 'b']);
    expect(mergeInventoryTag(undefined, '  x  ')).toEqual(['x']);
    expect(mergeInventoryTag(['a'], '   ')).toEqual(['a']);
  });

  it('omits by exact string', () => {
    expect(omitInventoryTag(['a', 'b'], 'a')).toEqual(['b']);
    expect(omitInventoryTag(['a'], 'missing')).toEqual(['a']);
    expect(omitInventoryTag(undefined, 'a')).toEqual([]);
  });
});

describe('buildInventoryTagsSavePayload', () => {
  it('keeps item fields and replaces tags', () => {
    const item = {
      id: '1',
      articleName: 'Shirt',
      brand: 'Acme',
      description: null,
      material: 'Cotton',
      purchasePrice: 10,
      recommendedPrice: 20,
      salePrice: null,
      currency: 'SEK',
      comment: null,
      tags: ['old'],
      variants: [
        {
          id: 'v1',
          itemId: '1',
          sku: 'SKU',
          audience: 'Men',
          color: 'Blue',
          size: 'M',
          quantity: 2,
          sortOrder: 0,
        },
      ],
      totalQuantity: 2,
      variantCount: 1,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    } satisfies InventoryItem;

    expect(buildInventoryTagsSavePayload(item, ['new'])).toEqual({
      articleName: 'Shirt',
      brand: 'Acme',
      description: null,
      material: 'Cotton',
      purchasePrice: 10,
      recommendedPrice: 20,
      salePrice: null,
      currency: 'SEK',
      comment: null,
      tags: ['new'],
      variants: [
        {
          id: 'v1',
          sku: 'SKU',
          audience: 'Men',
          color: 'Blue',
          size: 'M',
          quantity: 2,
          sortOrder: 0,
        },
      ],
    });
  });
});
