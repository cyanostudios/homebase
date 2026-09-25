import {
  buildInventoryLinkPatch,
  clearInventoryLinkPatch,
  formatInventoryVariantLabel,
  snapshotPriceFromInventory,
} from '../priceListInventoryLink';

describe('priceListInventoryLink', () => {
  const baseItem = {
    id: '9',
    articleName: 'Milk',
    brand: 'Arla',
    description: 'Fresh milk',
    material: '',
    purchasePrice: 8,
    recommendedPrice: 12,
    salePrice: 15,
    currency: 'SEK',
    comment: null,
    tags: [],
    slug: 'milk',
    featuredImageUrl: null,
    publicationStatus: 'published' as const,
    featured: false,
    variants: [],
    totalQuantity: 0,
    variantCount: 0,
    createdAt: '',
    updatedAt: '',
  };

  test('snapshotPriceFromInventory prefers sale then recommended', () => {
    expect(snapshotPriceFromInventory(baseItem)).toBe(15);
    expect(snapshotPriceFromInventory({ ...baseItem, salePrice: null })).toBe(12);
    expect(
      snapshotPriceFromInventory({
        ...baseItem,
        salePrice: null,
        recommendedPrice: null,
      }),
    ).toBe(0);
  });

  test('buildInventoryLinkPatch fills title/price and optional description', () => {
    const patch = buildInventoryLinkPatch(baseItem, null, { description: null });
    expect(patch).toMatchObject({
      inventoryItemId: '9',
      inventoryVariantId: null,
      title: 'Milk',
      price: 15,
      description: 'Fresh milk',
    });

    const keepDesc = buildInventoryLinkPatch(baseItem, null, {
      description: 'Custom note',
    });
    expect(keepDesc.description).toBeUndefined();
  });

  test('buildInventoryLinkPatch appends variant label to title', () => {
    const patch = buildInventoryLinkPatch(
      baseItem,
      {
        id: '3',
        sku: '',
        audience: 'Dairy',
        color: 'Whole',
        size: '1 L',
        quantity: 0,
      },
      { description: 'x' },
    );
    expect(patch.title).toBe('Milk · Dairy · Whole · 1 L');
    expect(patch.inventoryVariantId).toBe('3');
    expect(formatInventoryVariantLabel(patch as never)).toBeNull();
    expect(patch.inventoryVariantLabel).toBe('Dairy · Whole · 1 L');
  });

  test('clearInventoryLinkPatch nulls link fields only', () => {
    expect(clearInventoryLinkPatch()).toEqual({
      inventoryItemId: null,
      inventoryVariantId: null,
      inventoryArticleName: null,
      inventorySlug: null,
      inventoryVariantLabel: null,
    });
  });
});
