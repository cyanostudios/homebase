import type { ClubdeskInventoryItem } from '@/plugins/clubdesk/types/inventory';
import type { InventoryItem } from '@/plugins/garments/types/garments';

import {
  filterClubdeskArticlesForInvoicePicker,
  filterClubdeskPickerSuggestions,
  filterGarmentsArticlesForInvoicePicker,
  filterGarmentsPickerSuggestions,
  mapInventoryArticleToLineItem,
} from '../invoicableInventory';

function garment(partial: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'g1',
    articleName: 'Home shirt',
    brand: 'Nike',
    material: 'Poly',
    description: null,
    purchasePrice: null,
    recommendedPrice: null,
    salePrice: 299,
    currency: 'SEK',
    comment: null,
    tags: [],
    variants: [],
    ...partial,
  } as InventoryItem;
}

function clubdeskItem(partial: Partial<ClubdeskInventoryItem> = {}): ClubdeskInventoryItem {
  return {
    id: 'c1',
    articleName: 'Milk',
    brand: 'Arla',
    description: null,
    material: '',
    purchasePrice: null,
    recommendedPrice: null,
    salePrice: 15,
    currency: 'SEK',
    comment: null,
    tags: [],
    slug: 'milk',
    featuredImageUrl: null,
    publicationStatus: 'published',
    variants: [],
    ...partial,
  } as ClubdeskInventoryItem;
}

describe('invoicableInventory filters', () => {
  test('garments excludes archived', () => {
    const active = garment();
    const archived = garment({ archivedAt: '2026-01-01T00:00:00.000Z' });
    expect(filterGarmentsArticlesForInvoicePicker([active, archived])).toEqual([active]);
  });

  test('clubdesk uses linkable rule', () => {
    const ok = clubdeskItem();
    const draft = clubdeskItem({ publicationStatus: 'draft' });
    const archived = clubdeskItem({ archivedAt: '2026-01-01T00:00:00.000Z' });
    expect(filterClubdeskArticlesForInvoicePicker([ok, draft, archived])).toEqual([ok]);
  });

  test('picker suggestions cap at 40 and search garments', () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      garment({ id: String(i), articleName: `Item ${i}` }),
    );
    const result = filterGarmentsPickerSuggestions(rows, '');
    expect(result).toHaveLength(40);
    expect(filterGarmentsPickerSuggestions(rows, 'Item 49')).toHaveLength(1);
  });

  test('picker suggestions search clubdesk', () => {
    const rows = [
      clubdeskItem({ articleName: 'Oat milk' }),
      clubdeskItem({ id: '2', articleName: 'Juice' }),
    ];
    expect(filterClubdeskPickerSuggestions(rows, 'oat')).toHaveLength(1);
  });
});

describe('mapInventoryArticleToLineItem', () => {
  test('maps name, price, qty and vat', () => {
    const line = mapInventoryArticleToLineItem(
      { articleName: 'Cap', salePrice: 120 },
      { defaultVatRate: 12, sortOrder: 3, id: 'line-1' },
    );
    expect(line.description).toBe('Cap');
    expect(line.quantity).toBe(1);
    expect(line.unitPrice).toBe(120);
    expect(line.vatRate).toBe(12);
    expect(line.sortOrder).toBe(3);
    expect(line.id).toBe('line-1');
  });

  test('defaults missing sale price to zero', () => {
    const line = mapInventoryArticleToLineItem(
      { articleName: 'Gift', salePrice: null },
      { defaultVatRate: 25, sortOrder: 0 },
    );
    expect(line.unitPrice).toBe(0);
  });
});
