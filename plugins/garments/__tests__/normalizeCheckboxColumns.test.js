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
        { id: 'a', label: 'Betalt', group: 'Shorts', sortOrder: 0 },
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
    expect(list.checkboxColumns[0]).toEqual({
      id: 'a',
      label: 'Betalt',
      group: 'Shorts',
      sortOrder: 0,
    });
    expect(list.checkboxColumns[1].sortOrder).toBe(1);
    expect(list.checkboxColumns[1].group).toBeUndefined();
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
        jersey_name: 'ANDERSSON',
        initials: 'KA',
        comment: 'note',
        contact_id: 42,
        team_id: 5,
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
    expect(person.jerseyName).toBe('ANDERSSON');
    expect(person.initials).toBe('KA');
    expect(person.contactId).toBe('42');
    expect(person.teamId).toBe('5');
  });

  it('transforms person with null teamId when team_id is absent', () => {
    const person = model.transformPersonRow(
      {
        id: 10,
        list_id: 1,
        name: 'Bo',
        shirt_size: null,
        shorts_size: null,
        socks_size: null,
        jersey_number: null,
        jersey_name: null,
        initials: null,
        comment: null,
        contact_id: null,
        team_id: null,
        checkbox_values: {},
        sort_order: 0,
        created_at: null,
        updated_at: null,
      },
      [],
    );
    expect(person.teamId).toBeNull();
    expect(person.contactId).toBeNull();
  });

  it('transforms inventory row with embedded variants defaults', () => {
    const item = model.transformInventoryRow({
      id: 2,
      article_name: 'Strumpor',
      brand: 'Stadium',
      description: 'Matchstrumpor',
      material: 'Bomull',
      purchase_price: '149.50',
      recommended_price: '299.00',
      sale_price: '249.00',
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
      recommendedPrice: 299,
      salePrice: 249,
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
          audience: 'Women',
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
          audience: 'Men',
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
    expect(item.variants[0].audience).toBe('Women');
  });
});

describe('GarmentsController mapUniqueViolation', () => {
  const GarmentsController = require('../controller');
  const controller = new GarmentsController(new GarmentsModel());

  it('maps any unique violation to articleName field', () => {
    expect(
      controller.mapUniqueViolation({
        code: '23505',
        constraint: 'idx_garment_inventory_variants_unique',
      }),
    ).toEqual({
      field: 'articleName',
      message: 'An inventory item with this article and brand already exists',
    });
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

  it('updates quantity on the quantity-only path', async () => {
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

    const result = await model.updateInventoryVariantQuantity({}, 1, 2, 5);
    expect(result).toEqual({ id: '2', quantity: 5 });
  });
});

describe('GarmentsModel person teamId', () => {
  const model = new GarmentsModel();
  const listStub = {
    id: '1',
    checkboxColumns: [{ id: 'paid', label: 'Paid', sortOrder: 0 }],
  };

  const personRow = (overrides = {}) => ({
    id: 9,
    list_id: 1,
    name: 'Ada',
    shirt_size: null,
    shorts_size: null,
    socks_size: null,
    jersey_number: null,
    jersey_name: null,
    initials: null,
    comment: null,
    contact_id: null,
    team_id: 5,
    checkbox_values: {},
    sort_order: 0,
    created_at: null,
    updated_at: null,
    ...overrides,
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('createPerson persists optional teamId', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue(listStub);
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // resolveAllowedCheckboxIds
      .mockResolvedValueOnce({ rows: [{ m: -1 }] })
      .mockResolvedValueOnce({ rows: [personRow({ team_id: 7 })] })
      .mockResolvedValueOnce({ rows: [] });
    jest.spyOn(model, '_pool').mockReturnValue({ query });

    const result = await model.createPerson({}, 1, { name: 'Ada', teamId: '7' });

    expect(result.teamId).toBe('7');
    const insertParams = query.mock.calls[2][1];
    expect(insertParams[insertParams.length - 1]).toBe(7);
  });

  it('createPerson stores null teamId when omitted', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue(listStub);
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // resolveAllowedCheckboxIds
      .mockResolvedValueOnce({ rows: [{ m: 0 }] })
      .mockResolvedValueOnce({ rows: [personRow({ team_id: null })] })
      .mockResolvedValueOnce({ rows: [] });
    jest.spyOn(model, '_pool').mockReturnValue({ query });

    const result = await model.createPerson({}, 1, { name: 'Ada' });

    expect(result.teamId).toBeNull();
    const insertParams = query.mock.calls[2][1];
    expect(insertParams[insertParams.length - 1]).toBeNull();
  });

  it('updatePerson sets teamId when provided', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue(listStub);
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // resolveAllowedCheckboxIds
      .mockResolvedValueOnce({ rows: [personRow({ team_id: 5 })] })
      .mockResolvedValueOnce({ rows: [personRow({ team_id: 9 })] })
      .mockResolvedValueOnce({ rows: [] });
    jest.spyOn(model, '_pool').mockReturnValue({ query });

    const result = await model.updatePerson({}, 1, 9, { name: 'Ada', teamId: '9' });

    expect(result.teamId).toBe('9');
    const updateParams = query.mock.calls[2][1];
    // team_id is $12 in UPDATE (index 11)
    expect(updateParams[11]).toBe(9);
  });

  it('updatePerson clears teamId when null is sent', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue(listStub);
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // resolveAllowedCheckboxIds
      .mockResolvedValueOnce({ rows: [personRow({ team_id: 5 })] })
      .mockResolvedValueOnce({ rows: [personRow({ team_id: null })] })
      .mockResolvedValueOnce({ rows: [] });
    jest.spyOn(model, '_pool').mockReturnValue({ query });

    const result = await model.updatePerson({}, 1, 9, { name: 'Ada', teamId: null });

    expect(result.teamId).toBeNull();
    const updateParams = query.mock.calls[2][1];
    expect(updateParams[11]).toBeNull();
  });

  it('updatePerson preserves existing teamId when field is omitted', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue(listStub);
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] }) // resolveAllowedCheckboxIds
      .mockResolvedValueOnce({ rows: [personRow({ team_id: 5 })] })
      .mockResolvedValueOnce({ rows: [personRow({ team_id: 5, jersey_name: 'ADA' })] })
      .mockResolvedValueOnce({ rows: [] });
    jest.spyOn(model, '_pool').mockReturnValue({ query });

    const result = await model.updatePerson({}, 1, 9, { name: 'Ada', jerseyName: 'ADA' });

    expect(result.teamId).toBe('5');
    const updateParams = query.mock.calls[2][1];
    expect(updateParams[11]).toBe(5);
  });

  it('updatePerson keeps inv_* checkbox values for assigned inventory not in checkbox_columns', async () => {
    jest.spyOn(model, 'getListById').mockResolvedValue({
      ...listStub,
      checkboxColumns: [{ id: 'person_betalt', label: 'Paid', sortOrder: 0 }],
      assignedInventoryItemIds: ['12'],
    });
    const savedValues = { person_betalt: true, inv_12_ordered: true };
    const query = jest
      .fn()
      // resolveAllowedCheckboxIds — assigned inventory
      .mockResolvedValueOnce({ rows: [{ item_id: 12 }] })
      // existing person
      .mockResolvedValueOnce({ rows: [personRow({ checkbox_values: { person_betalt: false } })] })
      // UPDATE
      .mockResolvedValueOnce({
        rows: [personRow({ checkbox_values: savedValues })],
      })
      // touch list
      .mockResolvedValueOnce({ rows: [] });
    jest.spyOn(model, '_pool').mockReturnValue({ query });

    const result = await model.updatePerson({}, 1, 9, {
      name: 'Ada',
      checkboxValues: savedValues,
    });

    expect(result.checkboxValues).toEqual(savedValues);
    const updateParams = query.mock.calls[2][1];
    expect(JSON.parse(updateParams[8])).toEqual(savedValues);
  });
});
