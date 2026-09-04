import { nextListTableSort } from '@/core/list/listViewMode';

import {
  compareInventoryByField,
  isGarmentAscDefaultField,
  isInventoryAscDefaultField,
} from '../garmentListSort';
import type { InventoryItem } from '../../types/garments';

function item(
  partial: Partial<InventoryItem> & Pick<InventoryItem, 'id' | 'articleName'>,
): InventoryItem {
  return {
    brand: '',
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
    ...partial,
  };
}

describe('garmentListSort', () => {
  it('defaults name/article strings to ascending', () => {
    expect(isGarmentAscDefaultField('name')).toBe(true);
    expect(isGarmentAscDefaultField('personCount')).toBe(false);
    expect(isInventoryAscDefaultField('articleName')).toBe(true);
    expect(isInventoryAscDefaultField('brand')).toBe(true);
  });

  it('defaults quantity magnitude to descending (highest first)', () => {
    expect(isInventoryAscDefaultField('totalQuantity')).toBe(false);
    expect(isInventoryAscDefaultField('variantCount')).toBe(false);
    expect(
      nextListTableSort('articleName', 'asc', 'totalQuantity', isInventoryAscDefaultField),
    ).toEqual({
      field: 'totalQuantity',
      order: 'desc',
    });
  });

  it('compares totalQuantity numerically', () => {
    const low = item({ id: '1', articleName: 'A', totalQuantity: 2 });
    const high = item({ id: '2', articleName: 'B', totalQuantity: 10 });
    expect(compareInventoryByField(low, high, 'totalQuantity', 'asc')).toBeLessThan(0);
    expect(compareInventoryByField(low, high, 'totalQuantity', 'desc')).toBeGreaterThan(0);
  });
});
