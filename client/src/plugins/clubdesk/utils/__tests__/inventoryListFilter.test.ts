import {
  inventoryItemVisibleInCatalog,
  isInventoryItemArchived,
  isInventoryItemLinkable,
} from '../inventoryListFilter';
import type { ClubdeskInventoryItem } from '../../types/inventory';

function item(overrides: Partial<ClubdeskInventoryItem> = {}): ClubdeskInventoryItem {
  return {
    id: '1',
    articleName: 'Milk',
    brand: 'Local',
    description: null,
    material: '',
    purchasePrice: null,
    recommendedPrice: null,
    salePrice: null,
    currency: 'SEK',
    comment: null,
    tags: [],
    slug: 'milk',
    featuredImageUrl: null,
    publicationStatus: 'published',
    featured: false,
    variants: [],
    totalQuantity: 0,
    variantCount: 0,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('clubdesk inventory catalog archive filter', () => {
  test('active catalog hides archived articles until search matches', () => {
    const archived = item({ archivedAt: '2026-09-30T00:00:00.000Z' });
    expect(isInventoryItemArchived(archived)).toBe(true);
    expect(inventoryItemVisibleInCatalog(archived, { archivedOnly: false, searchTerm: '' })).toBe(
      false,
    );
    expect(
      inventoryItemVisibleInCatalog(archived, { archivedOnly: false, searchTerm: 'milk' }),
    ).toBe(true);
    expect(inventoryItemVisibleInCatalog(item(), { archivedOnly: false, searchTerm: '' })).toBe(
      true,
    );
  });

  test('archived chip shows only archived articles', () => {
    expect(inventoryItemVisibleInCatalog(item(), { archivedOnly: true, searchTerm: '' })).toBe(
      false,
    );
    expect(
      inventoryItemVisibleInCatalog(item({ archivedAt: '2026-09-30T00:00:00.000Z' }), {
        archivedOnly: true,
        searchTerm: '',
      }),
    ).toBe(true);
  });
});

describe('isInventoryItemLinkable', () => {
  test('allows only published articles that are not archived', () => {
    expect(isInventoryItemLinkable(item())).toBe(true);
    expect(isInventoryItemLinkable(item({ publicationStatus: 'draft' }))).toBe(false);
    expect(isInventoryItemLinkable(item({ archivedAt: '2026-09-30T00:00:00.000Z' }))).toBe(false);
  });
});
