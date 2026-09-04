import { nextListTableSort } from '@/core/list/listViewMode';

import { comparePriceListsByField, isPriceListAscDefaultField } from '../priceListListSort';
import type { ClubdeskPriceList } from '../../types/priceList';

function priceList(
  partial: Partial<ClubdeskPriceList> & Pick<ClubdeskPriceList, 'id' | 'title'>,
): ClubdeskPriceList {
  return {
    slug: 'slug',
    description: null,
    featuredImageUrl: null,
    publicationStatus: 'draft',
    featured: false,
    currency: 'SEK',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-02T00:00:00.000Z',
    ...partial,
  };
}

describe('priceListListSort', () => {
  it('defaults string fields to ascending; itemCount magnitude to descending', () => {
    expect(isPriceListAscDefaultField('title')).toBe(true);
    expect(isPriceListAscDefaultField('currency')).toBe(true);
    expect(isPriceListAscDefaultField('itemCount')).toBe(false);
    expect(isPriceListAscDefaultField('updatedAt')).toBe(false);
  });

  it('compares currency and itemCount', () => {
    const a = priceList({ id: '1', title: 'A', currency: 'EUR', itemCount: 2 });
    const b = priceList({ id: '2', title: 'B', currency: 'SEK', itemCount: 5 });
    expect(comparePriceListsByField(a, b, 'currency', 'asc')).toBeLessThan(0);
    expect(comparePriceListsByField(a, b, 'itemCount', 'asc')).toBeLessThan(0);
    expect(comparePriceListsByField(a, b, 'itemCount', 'desc')).toBeGreaterThan(0);
  });

  it('toggles table sort via nextListTableSort', () => {
    expect(nextListTableSort('title', 'asc', 'title', isPriceListAscDefaultField)).toEqual({
      field: 'title',
      order: 'desc',
    });
    expect(nextListTableSort('title', 'asc', 'updatedAt', isPriceListAscDefaultField)).toEqual({
      field: 'updatedAt',
      order: 'desc',
    });
    expect(nextListTableSort('title', 'asc', 'itemCount', isPriceListAscDefaultField)).toEqual({
      field: 'itemCount',
      order: 'desc',
    });
  });
});
