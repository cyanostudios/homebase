import {
  buildDuplicatedItemVariantPayloads,
  buildDuplicatedVariantPayload,
  validateInventoryPayload,
} from '../inventoryValidation';

const messages = {
  articleNameRequired: 'article required',
  purchasePriceInvalid: 'price invalid',
  quantityInvalid: 'qty invalid',
  variantDuplicate: 'color/size dup',
  variantSkuDuplicate: 'sku dup',
};

describe('validateInventoryPayload', () => {
  it('rejects duplicate non-empty SKUs case-insensitively', () => {
    const errors = validateInventoryPayload(
      {
        articleName: 'Tee',
        brand: '',
        variants: [
          { sku: 'ABC-1', color: 'Black', size: 'M', quantity: 1 },
          { sku: 'abc-1', color: 'White', size: 'L', quantity: 1 },
        ],
      },
      messages,
    );
    expect(errors.some((e) => e.message === messages.variantSkuDuplicate)).toBe(true);
  });

  it('allows empty SKUs on multiple variants', () => {
    const errors = validateInventoryPayload(
      {
        articleName: 'Tee',
        brand: '',
        variants: [
          { sku: '', color: 'Black', size: 'M', quantity: 1 },
          { sku: '  ', color: 'White', size: 'L', quantity: 1 },
        ],
      },
      messages,
    );
    expect(errors).toEqual([]);
  });

  it('rejects duplicate color and size', () => {
    const errors = validateInventoryPayload(
      {
        articleName: 'Tee',
        brand: '',
        variants: [
          { sku: 'A', color: 'Black', size: 'M', quantity: 1 },
          { sku: 'B', color: 'black', size: 'm', quantity: 2 },
        ],
      },
      messages,
    );
    expect(errors.some((e) => e.message === messages.variantDuplicate)).toBe(true);
  });
});

describe('buildDuplicatedVariantPayload', () => {
  it('clears sku and size so the copy does not collide on save', () => {
    const copy = buildDuplicatedVariantPayload({
      sku: 'KEEP-ME',
      color: 'Navy',
      size: 'L',
      quantity: 3,
      sortOrder: 1,
    });
    expect(copy).toEqual({
      sku: '',
      color: 'Navy',
      size: '',
      quantity: 3,
      sortOrder: 1,
    });

    const withSource = validateInventoryPayload(
      {
        articleName: 'Tee',
        brand: '',
        variants: [{ sku: 'KEEP-ME', color: 'Navy', size: 'L', quantity: 3 }, copy],
      },
      messages,
    );
    expect(withSource).toEqual([]);
  });
});

describe('buildDuplicatedItemVariantPayloads', () => {
  it('clears all SKUs and keeps color/size unique among copies', () => {
    const copies = buildDuplicatedItemVariantPayloads([
      { sku: 'A1', color: 'Black', size: 'M', quantity: 2, sortOrder: 0 },
      { sku: 'A2', color: 'White', size: 'L', quantity: 1, sortOrder: 1 },
    ]);
    expect(copies.every((v) => v.sku === '')).toBe(true);
    expect(copies[0].color).toBe('Black');
    expect(copies[1].size).toBe('L');

    const errors = validateInventoryPayload(
      { articleName: 'Copy of Tee', brand: '', variants: copies },
      messages,
    );
    expect(errors).toEqual([]);
  });
});
