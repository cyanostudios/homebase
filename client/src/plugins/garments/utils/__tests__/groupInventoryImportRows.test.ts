import { groupInventoryImportRows } from '../groupInventoryImportRows';

describe('groupInventoryImportRows', () => {
  it('groups rows by article name and brand into one item with variants', () => {
    const { payloads, skippedRowCount } = groupInventoryImportRows([
      {
        articleName: 'Match Jersey',
        brand: 'Nike',
        description: 'Home kit',
        sku: 'NJ-M',
        audience: 'Men',
        color: 'Red',
        size: 'M',
        quantity: '10',
      },
      {
        articleName: 'Match Jersey',
        brand: 'Nike',
        description: 'Home kit',
        sku: 'NJ-L',
        audience: 'Men',
        color: 'Red',
        size: 'L',
        quantity: '5',
      },
    ]);

    expect(skippedRowCount).toBe(0);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].articleName).toBe('Match Jersey');
    expect(payloads[0].brand).toBe('Nike');
    expect(payloads[0].description).toBe('Home kit');
    expect(payloads[0].variants).toHaveLength(2);
    expect(payloads[0].variants?.[0]).toMatchObject({
      sku: 'NJ-M',
      audience: 'Men',
      color: 'Red',
      size: 'M',
      quantity: 10,
      sortOrder: 0,
    });
    expect(payloads[0].variants?.[1]).toMatchObject({
      sku: 'NJ-L',
      size: 'L',
      quantity: 5,
      sortOrder: 1,
    });
  });

  it('groups case-insensitively on article and brand', () => {
    const { payloads } = groupInventoryImportRows([
      { articleName: 'Tee', brand: 'Adidas', size: 'S' },
      { articleName: 'tee', brand: 'adidas', size: 'M' },
    ]);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].variants).toHaveLength(2);
  });

  it('creates separate items for different brands', () => {
    const { payloads } = groupInventoryImportRows([
      { articleName: 'Tee', brand: 'Adidas', size: 'S' },
      { articleName: 'Tee', brand: 'Nike', size: 'M' },
    ]);
    expect(payloads).toHaveLength(2);
  });

  it('counts rows without article name as skipped', () => {
    const { payloads, skippedRowCount, skippedEmptyArticle, skippedArticleUnmapped } =
      groupInventoryImportRows([
        { brand: 'Nike', size: 'M' },
        { articleName: 'Shorts', brand: 'Puma', size: 'L' },
      ]);
    expect(skippedRowCount).toBe(1);
    expect(skippedArticleUnmapped).toBe(1);
    expect(skippedEmptyArticle).toBe(0);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].articleName).toBe('Shorts');
  });

  it('tracks empty mapped article cells separately', () => {
    const { skippedEmptyArticle, skippedArticleUnmapped } = groupInventoryImportRows([
      { articleName: '  ', brand: 'Nike' },
    ]);
    expect(skippedEmptyArticle).toBe(1);
    expect(skippedArticleUnmapped).toBe(0);
  });

  it('parses decimal prices with comma', () => {
    const { payloads } = groupInventoryImportRows([
      {
        articleName: 'Cap',
        purchasePrice: '99,50',
        recommendedPrice: '149',
        salePrice: '129,00',
        currency: 'SEK',
      },
    ]);
    expect(payloads[0].purchasePrice).toBe(99.5);
    expect(payloads[0].recommendedPrice).toBe(149);
    expect(payloads[0].salePrice).toBe(129);
    expect(payloads[0].currency).toBe('SEK');
  });

  it('accepts article alias fields', () => {
    const { payloads } = groupInventoryImportRows([{ article: 'Via alias', brand: 'X' }]);
    expect(payloads[0].articleName).toBe('Via alias');
  });
});
