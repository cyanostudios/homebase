import { mergeInventorySaved } from '../GarmentProvider';
import type { InventoryItem } from '../../types/garments';

function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: '7',
    articleName: 'Sauce',
    brand: 'Old',
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
  };
}

describe('mergeInventorySaved', () => {
  it('keeps existing list assignments when the saved row has none', () => {
    const existing = item({ assignedListIds: ['3', '9'] });
    const saved = item({
      articleName: 'Sauce',
      archivedAt: '2026-09-29T00:00:00.000Z',
      assignedListIds: [],
    });
    expect(mergeInventorySaved(existing, saved).assignedListIds).toEqual(['3', '9']);
    expect(mergeInventorySaved(existing, saved).archivedAt).toBe('2026-09-29T00:00:00.000Z');
  });

  it('uses saved assignments when the response includes them', () => {
    const existing = item({ assignedListIds: ['3'] });
    const saved = item({ assignedListIds: ['4'] });
    expect(mergeInventorySaved(existing, saved).assignedListIds).toEqual(['4']);
  });
});
