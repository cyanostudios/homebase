import {
  buildDuplicatedItemVariantPayloads,
  buildDuplicatedVariantPayload,
  findDuplicateAudienceColorSizeIndices,
  findDuplicateSkuIndices,
  findDuplicateVariantIndices,
  validateInventoryPayload,
} from '../inventoryValidation';

const messages = {
  articleNameRequired: 'article required',
  purchasePriceInvalid: 'price invalid',
  recommendedPriceInvalid: 'rek invalid',
  salePriceInvalid: 'sale invalid',
  quantityInvalid: 'qty invalid',
  gtinInvalid: 'gtin invalid',
};

describe('validateInventoryPayload', () => {
  it('allows duplicate audience, color, size and SKU', () => {
    const errors = validateInventoryPayload(
      {
        articleName: 'Pants',
        brand: '',
        variants: [
          { sku: 'PANT-1', audience: 'Women', color: 'Black', size: 'M', quantity: 1 },
          { sku: 'PANT-1', audience: 'Women', color: 'Black', size: 'M', quantity: 2 },
        ],
      },
      messages,
    );
    expect(errors).toEqual([]);
  });

  it('rejects invalid quantity', () => {
    const errors = validateInventoryPayload(
      {
        articleName: 'Tee',
        brand: '',
        variants: [{ sku: 'A', color: 'Black', size: 'M', quantity: -1 }],
      },
      messages,
    );
    expect(errors.some((e) => e.message === messages.quantityInvalid)).toBe(true);
  });
});

describe('findDuplicateSkuIndices', () => {
  it('marks indices that share a non-empty art.nr case-insensitively', () => {
    const indices = findDuplicateSkuIndices([
      { sku: 'ABC-1', color: 'Black', size: 'M' },
      { sku: 'unique', color: 'Red', size: 'S' },
      { sku: 'abc-1', color: 'White', size: 'L' },
      { sku: '', color: 'Blue', size: 'M' },
    ]);
    expect([...indices].sort()).toEqual([0, 2]);
  });
});

describe('findDuplicateAudienceColorSizeIndices', () => {
  it('marks indices that share audience, color and size', () => {
    const indices = findDuplicateAudienceColorSizeIndices([
      { audience: 'Women', color: 'Black', size: 'M' },
      { audience: 'Men', color: 'Black', size: 'M' },
      { audience: 'women', color: 'black', size: 'm' },
    ]);
    expect([...indices].sort()).toEqual([0, 2]);
  });
});

describe('findDuplicateVariantIndices', () => {
  it('unions sku and identity duplicates', () => {
    const result = findDuplicateVariantIndices([
      { sku: 'SAME', audience: 'Women', color: 'Black', size: 'M' },
      { sku: 'OTHER', audience: 'Women', color: 'Black', size: 'M' },
      { sku: 'same', audience: 'Men', color: 'Red', size: 'L' },
    ]);
    expect([...result.identity].sort()).toEqual([0, 1]);
    expect([...result.sku].sort()).toEqual([0, 2]);
    expect([...result.any].sort()).toEqual([0, 1, 2]);
  });
});

describe('validateInventoryPayload GTIN', () => {
  it('accepts empty and 8, 12, 13, or 14 digits, including spaces', () => {
    const base = { articleName: 'Jersey', variants: [{ gtin: '' }] };
    expect(validateInventoryPayload(base, messages)).toEqual([]);
    for (const gtin of ['12345678', '123456789012', '1234567890123', '0731 2345 678901']) {
      expect(validateInventoryPayload({ ...base, variants: [{ gtin }] }, messages)).toEqual([]);
    }
  });

  it('rejects a GTIN that is not 8, 12, 13, or 14 digits', () => {
    const errors = validateInventoryPayload(
      { articleName: 'Jersey', variants: [{ gtin: '12345' }] },
      messages,
    );
    expect(errors).toEqual([{ field: 'variants.0.gtin', message: 'gtin invalid' }]);
  });
});

describe('buildDuplicatedVariantPayload', () => {
  it('copies audience/color/size and clears sku, gtin, and quantity', () => {
    const copy = buildDuplicatedVariantPayload({
      sku: 'KEEP-ME',
      gtin: '07312345678901',
      audience: 'Women',
      color: 'Navy',
      size: 'L',
      quantity: 3,
      sortOrder: 1,
    });
    expect(copy).toEqual({
      sku: '',
      gtin: '',
      audience: 'Women',
      color: 'Navy',
      size: 'L',
      quantity: 0,
      sortOrder: 1,
    });
  });
});

describe('buildDuplicatedItemVariantPayloads', () => {
  it('clears all SKUs and GTINs and keeps audience/color/size', () => {
    const copies = buildDuplicatedItemVariantPayloads([
      { sku: 'A1', audience: 'Women', color: 'Black', size: 'M', quantity: 2, sortOrder: 0 },
      { sku: 'A2', audience: 'Men', color: 'White', size: 'L', quantity: 1, sortOrder: 1 },
    ]);
    expect(copies.every((v) => v.sku === '' && v.gtin === '')).toBe(true);
    expect(copies[0].audience).toBe('Women');
    expect(copies[1].size).toBe('L');
  });
});
