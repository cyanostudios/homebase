import {
  buildInventoryLinkPatch,
  catalogPriceFromInventoryFields,
  clearInventoryLinkPatch,
  formatInventoryVariantLabel,
  resolveEffectivePriceListItemPrice,
  snapshotPriceFromInventory,
  syncPriceListItemsWithInventoryCatalog,
  withLiveInventoryCatalogPrice,
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

  test('catalogPriceFromInventoryFields mirrors snapshot without zero fallback', () => {
    expect(catalogPriceFromInventoryFields(15, 12)).toBe(15);
    expect(catalogPriceFromInventoryFields(null, 12)).toBe(12);
    expect(catalogPriceFromInventoryFields(null, null)).toBeNull();
  });

  test('resolveEffectivePriceListItemPrice prefers override then catalog then price', () => {
    expect(
      resolveEffectivePriceListItemPrice({
        priceOverride: 99,
        inventoryCatalogPrice: 15,
        price: 10,
      }),
    ).toBe(99);
    expect(
      resolveEffectivePriceListItemPrice({
        priceOverride: null,
        inventoryCatalogPrice: 15,
        price: 10,
      }),
    ).toBe(15);
    expect(
      resolveEffectivePriceListItemPrice({
        priceOverride: null,
        inventoryCatalogPrice: null,
        price: 10,
      }),
    ).toBe(10);
  });

  test('withLiveInventoryCatalogPrice refreshes catalog and price when following', () => {
    const inventoryById = new Map([['9', { ...baseItem, salePrice: 42 }]]);
    const row = {
      title: 'Milk',
      description: null as string | null,
      price: 15,
      priceOverride: null as number | null,
      inventoryCatalogPrice: 15 as number | null,
      category: null as string | null,
      sequenceOrder: 1,
      inventoryItemId: '9',
    };
    expect(withLiveInventoryCatalogPrice(row, inventoryById)).toEqual({
      ...row,
      inventoryCatalogPrice: 42,
      price: 42,
    });
  });

  test('withLiveInventoryCatalogPrice keeps list override but updates catalog field', () => {
    const inventoryById = new Map([['9', { ...baseItem, salePrice: 42 }]]);
    const row = {
      title: 'Milk',
      description: null as string | null,
      price: 99,
      priceOverride: 99 as number | null,
      inventoryCatalogPrice: 15 as number | null,
      category: null as string | null,
      sequenceOrder: 1,
      inventoryItemId: '9',
    };
    expect(withLiveInventoryCatalogPrice(row, inventoryById)).toEqual({
      ...row,
      inventoryCatalogPrice: 42,
      price: 99,
      priceOverride: 99,
    });
  });

  test('syncPriceListItemsWithInventoryCatalog returns same array when unchanged', () => {
    const items = [
      {
        title: 'Milk',
        description: null as string | null,
        price: 15,
        priceOverride: null as number | null,
        inventoryCatalogPrice: 15 as number | null,
        category: null as string | null,
        sequenceOrder: 1,
        inventoryItemId: '9',
      },
    ];
    expect(syncPriceListItemsWithInventoryCatalog(items, [baseItem])).toBe(items);
  });

  test('buildInventoryLinkPatch fills title/price and optional description', () => {
    const patch = buildInventoryLinkPatch(baseItem, null, { description: null });
    expect(patch).toMatchObject({
      inventoryItemId: '9',
      inventoryVariantId: null,
      title: 'Milk',
      price: 15,
      priceOverride: null,
      inventoryCatalogPrice: 15,
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
      inventoryCatalogPrice: null,
    });
  });
});
