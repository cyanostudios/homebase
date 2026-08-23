// plugins/garments/__tests__/normalizeCheckboxColumns.test.js
const GarmentsModel = require('../model');

// Re-test via transform helpers by creating model and calling transform methods
describe('GarmentsModel transforms', () => {
  const model = new GarmentsModel();

  it('transforms list row with checkbox columns', () => {
    const list = model.transformListRow({
      id: 1,
      name: 'P2015',
      team_id: 5,
      checkbox_columns: JSON.stringify([
        { id: 'a', label: 'Betalt', sortOrder: 0 },
        { id: 'b', label: 'Tröja Beställt', sort_order: 1 },
      ]),
      person_count: 3,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    });
    expect(list.id).toBe('1');
    expect(list.teamId).toBe('5');
    expect(list.personCount).toBe(3);
    expect(list.checkboxColumns).toHaveLength(2);
    expect(list.checkboxColumns[0]).toEqual({ id: 'a', label: 'Betalt', sortOrder: 0 });
    expect(list.checkboxColumns[1].sortOrder).toBe(1);
  });

  it('transforms person and filters checkbox values to allowed ids', () => {
    const person = model.transformPersonRow(
      {
        id: 9,
        list_id: 1,
        name: 'Ada',
        shirt_size: '152',
        shorts_size: null,
        socks_size: '2',
        jersey_number: '7',
        comment: 'note',
        checkbox_values: { a: true, stale: true },
        sort_order: 0,
        created_at: null,
        updated_at: null,
      },
      ['a'],
    );
    expect(person.checkboxValues).toEqual({ a: true });
    expect(person.shirtSize).toBe('152');
    expect(person.jerseyNumber).toBe('7');
  });

  it('transforms inventory row with embedded variants defaults', () => {
    const item = model.transformInventoryRow({
      id: 2,
      article_name: 'Strumpor',
      brand: 'Stadium',
      description: 'Matchstrumpor',
      material: 'Bomull',
      purchase_price: '149.50',
      currency: 'SEK',
      comment: 'Hylla A',
      created_at: null,
      updated_at: null,
    });
    expect(item).toMatchObject({
      id: '2',
      articleName: 'Strumpor',
      brand: 'Stadium',
      description: 'Matchstrumpor',
      material: 'Bomull',
      purchasePrice: 149.5,
      currency: 'SEK',
      comment: 'Hylla A',
      variants: [],
      totalQuantity: 0,
      variantCount: 0,
    });
  });

  it('attaches variants and aggregates quantity', () => {
    const item = model.attachVariants(
      model.transformInventoryRow({
        id: 3,
        article_name: 'Tröja',
        brand: '',
        description: null,
        material: '',
        purchase_price: null,
        currency: 'SEK',
        comment: null,
        created_at: null,
        updated_at: null,
      }),
      [
        model.transformVariantRow({
          id: 10,
          item_id: 3,
          sku: 'A1',
          color: 'Svart',
          size: 'M',
          quantity: 5,
          sort_order: 0,
          created_at: null,
          updated_at: null,
        }),
        model.transformVariantRow({
          id: 11,
          item_id: 3,
          sku: 'A2',
          color: 'Vit',
          size: 'L',
          quantity: 3,
          sort_order: 1,
          created_at: null,
          updated_at: null,
        }),
      ],
    );
    expect(item.variantCount).toBe(2);
    expect(item.totalQuantity).toBe(8);
    expect(item.variants[0].sku).toBe('A1');
  });

  it('rejects duplicate non-empty SKUs on assertNoDuplicateVariants', () => {
    expect(() =>
      model.assertNoDuplicateVariants([
        { sku: 'ABC-1', color: 'Black', size: 'M', quantity: 1 },
        { sku: 'abc-1', color: 'White', size: 'L', quantity: 1 },
      ]),
    ).toThrow(/article number/i);
  });

  it('allows empty SKUs and unique SKUs on assertNoDuplicateVariants', () => {
    expect(() =>
      model.assertNoDuplicateVariants([
        { sku: '', color: 'Black', size: 'M', quantity: 1 },
        { sku: '  ', color: 'White', size: 'L', quantity: 1 },
        { sku: 'ABC-2', color: 'Red', size: 'S', quantity: 1 },
      ]),
    ).not.toThrow();
  });
});

describe('GarmentsController mapUniqueViolation', () => {
  const GarmentsController = require('../controller');
  const controller = new GarmentsController(new GarmentsModel());

  it('maps SKU unique index to article-number message (not color/size)', () => {
    expect(
      controller.mapUniqueViolation({
        code: '23505',
        constraint: 'idx_garment_inventory_variants_sku_unique',
      }),
    ).toEqual({
      field: 'variants',
      message: 'A variant with this article number already exists on this item',
    });
  });

  it('maps color/size unique index to color/size message', () => {
    expect(
      controller.mapUniqueViolation({
        code: '23505',
        constraint: 'idx_garment_inventory_variants_unique',
      }),
    ).toEqual({
      field: 'variants',
      message: 'A variant with this color and size already exists on this item',
    });
  });

  it('maps article unique index to articleName field', () => {
    expect(
      controller.mapUniqueViolation({
        code: '23505',
        constraint: 'idx_garment_inventory_unique_article',
      }),
    ).toEqual({
      field: 'articleName',
      message: 'An inventory item with this article and brand already exists',
    });
  });

  it('returns null for non-unique-violation errors', () => {
    expect(controller.mapUniqueViolation({ code: '23503' })).toBeNull();
  });
});

describe('GarmentsModel updateInventoryVariantQuantity', () => {
  const model = new GarmentsModel();

  it('does not call assertNoDuplicateVariants (quantity-only path)', async () => {
    const assertSpy = jest.spyOn(model, 'assertNoDuplicateVariants');
    jest.spyOn(model, 'getInventoryById').mockResolvedValue({ id: '1', articleName: 'Tee' });
    jest.spyOn(model, '_pool').mockReturnValue({
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 2,
              item_id: 1,
              sku: 'A1',
              color: 'Black',
              size: 'M',
              quantity: 5,
              sort_order: 0,
              created_at: null,
              updated_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
    });
    jest.spyOn(model, 'transformVariantRow').mockImplementation((row) => ({
      id: String(row.id),
      quantity: row.quantity,
    }));

    await model.updateInventoryVariantQuantity({}, 1, 2, 5);

    expect(assertSpy).not.toHaveBeenCalled();
    assertSpy.mockRestore();
  });
});
