jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { normalizeGtin } = require('../inventoryModel');
const {
  mapSeedToColumnValues,
  buildFillEmptyUpdates,
  shouldSkipSeedRowDueToNameKeyConflict,
  pickNameFallbackRow,
  parseSeedNumeric,
} = require('../services/kioskCatalogSeedLogic');
const { processSeedRow, mergeSeedIntoExisting } = require('../services/kioskCatalogSeed');

function mockClient(state) {
  return {
    query: jest.fn(async (sql, params) => {
      state.queries.push({ sql: String(sql), params });
      if (
        String(sql).includes('FROM clubdesk_inventory_items') &&
        String(sql).includes('catalog_key = $2')
      ) {
        const row = state.byCatalogKey.get(params[1]) || null;
        return { rows: row ? [row] : [] };
      }
      if (
        String(sql).includes('archived_at IS NULL') &&
        String(sql).includes('lower(article_name)')
      ) {
        const rows = state.activeByName.get(String(params[1]).toLowerCase()) || [];
        return { rows };
      }
      if (String(sql).includes('lower(brand) = lower($4)')) {
        const conflict = state.brandConflicts.has(`${params[2]}|${params[3]}|${params[4]}`);
        return { rows: conflict ? [{ id: 99 }] : [] };
      }
      if (String(sql).includes('UPDATE clubdesk_inventory_items')) {
        state.updated.push(params);
        return { rows: [] };
      }
      if (String(sql).includes('INSERT INTO clubdesk_inventory_items')) {
        state.inserted.push(params);
        return { rows: [] };
      }
      if (String(sql).includes('MAX(sort_order)')) {
        return { rows: [{ next: 1 }] };
      }
      if (String(sql).includes('lower(slug) = lower')) {
        return { rows: [] };
      }
      return { rows: [] };
    }),
  };
}

describe('kioskCatalogSeedLogic', () => {
  test('mapSeedToColumnValues maps product fields and parses nutrition', () => {
    const mapped = mapSeedToColumnValues({
      catalog_key: 'abc',
      product_name: 'Cola',
      brand: 'Brand',
      size: '33',
      unit: 'cl',
      energy_kcal_100g: '42',
      sugar_g_100g: '',
      source: 'Dabas',
    });
    expect(mapped.catalog_key).toBe('abc');
    expect(mapped.article_name).toBe('Cola');
    expect(mapped.package_size).toBe('33');
    expect(mapped.energy_kcal_100g).toBe(42);
    expect(mapped.sugar_g_100g).toBeUndefined();
    expect(mapped.catalog_source).toBe('Dabas');
  });

  test('buildFillEmptyUpdates fills empty only and empty seed does not clear', () => {
    const existing = {
      brand: 'Keep',
      description: 'Old',
      category: '',
      energy_kcal_100g: 10,
    };
    const { updates } = buildFillEmptyUpdates(
      existing,
      mapSeedToColumnValues({
        brand: 'New',
        product_description: '',
        category: 'Drinks',
        energy_kcal_100g: '99',
      }),
    );
    expect(updates.brand).toBeUndefined();
    expect(updates.description).toBeUndefined();
    expect(updates.category).toBe('Drinks');
    expect(updates.energy_kcal_100g).toBeUndefined();
  });

  test('pickNameFallbackRow chooses MIN(id)', () => {
    expect(
      pickNameFallbackRow([
        { id: 5, catalog_key: '' },
        { id: 2, catalog_key: null },
        { id: 9, catalog_key: '' },
      ]).id,
    ).toBe(2);
  });

  test('shouldSkipSeedRowDueToNameKeyConflict when another key owns the name', () => {
    expect(
      shouldSkipSeedRowDueToNameKeyConflict(
        [{ catalog_key: 'other-key' }, { catalog_key: '' }],
        'seed-key',
      ),
    ).toBe(true);
    expect(shouldSkipSeedRowDueToNameKeyConflict([{ catalog_key: 'seed-key' }], 'seed-key')).toBe(
      false,
    );
  });

  test('parseSeedNumeric leaves empty as null mapping omission', () => {
    expect(parseSeedNumeric('')).toBeNull();
    expect(parseSeedNumeric('4.6')).toBe(4.6);
  });
});

describe('kioskCatalogSeed processSeedRow', () => {
  test('merge by catalog_key', async () => {
    const state = {
      queries: [],
      byCatalogKey: new Map([['key-1', { id: 3, catalog_key: 'key-1', brand: '', category: '' }]]),
      activeByName: new Map(),
      brandConflicts: new Set(),
      updated: [],
      inserted: [],
    };
    const client = mockClient(state);
    const result = await processSeedRow(client, 7, {
      catalog_key: 'key-1',
      product_name: 'X',
      category: 'Snacks',
    });
    expect(result.action).toBe('updated');
    expect(state.inserted).toHaveLength(0);
    expect(state.updated.length).toBeGreaterThan(0);
  });

  test('name fallback MIN(id) sets catalog_key when empty', async () => {
    const state = {
      queries: [],
      byCatalogKey: new Map(),
      activeByName: new Map([
        [
          'cola',
          [
            { id: 8, catalog_key: '', article_name: 'Cola', brand: '', category: '' },
            { id: 2, catalog_key: '', article_name: 'Cola', brand: '', category: '' },
          ],
        ],
      ]),
      brandConflicts: new Set(),
      updated: [],
      inserted: [],
    };
    const client = mockClient(state);
    await processSeedRow(client, 1, {
      catalog_key: 'cola-key',
      product_name: 'Cola',
      category: 'Drinks',
    });
    const updateSql = state.queries.find((q) => q.sql.includes('UPDATE clubdesk_inventory_items'));
    expect(updateSql.params).toEqual(expect.arrayContaining(['cola-key', 'Drinks']));
  });

  test('no second insert when another key owns the name', async () => {
    const state = {
      queries: [],
      byCatalogKey: new Map(),
      activeByName: new Map([
        ['pepsi', [{ id: 1, catalog_key: 'existing-key', article_name: 'Pepsi' }]],
      ]),
      brandConflicts: new Set(),
      updated: [],
      inserted: [],
    };
    const client = mockClient(state);
    const result = await processSeedRow(client, 1, {
      catalog_key: 'new-key',
      product_name: 'Pepsi',
    });
    expect(result).toEqual({ action: 'skipped', reason: 'name_owned_by_other_catalog_key' });
    expect(state.inserted).toHaveLength(0);
  });

  test('draft insert with zero variants', async () => {
    const state = {
      queries: [],
      byCatalogKey: new Map(),
      activeByName: new Map(),
      brandConflicts: new Set(),
      updated: [],
      inserted: [],
    };
    const client = mockClient(state);
    const result = await processSeedRow(client, 1, {
      catalog_key: 'new-item',
      product_name: 'New Product',
      brand: 'B',
    });
    expect(result.action).toBe('inserted');
    expect(state.inserted).toHaveLength(1);
    expect(state.queries.some((q) => q.sql.includes('clubdesk_inventory_variants'))).toBe(false);
    expect(state.inserted[0]).toEqual(expect.arrayContaining(['draft', false]));
  });

  test('GTIN normalize on merge', async () => {
    const existing = { id: 1, gtin: '', brand: '', article_name: 'Bar' };
    const client = {
      query: jest.fn(async (sql) => {
        if (String(sql).includes('lower(brand)')) return { rows: [] };
        if (String(sql).startsWith('UPDATE')) return { rows: [] };
        return { rows: [] };
      }),
    };
    const result = await mergeSeedIntoExisting(client, 1, existing, {
      gtin: ' 07622202277795 ',
    });
    expect(result.action).toBe('updated');
    expect(normalizeGtin('07622202277795')).toBe('07622202277795');
    const updateCall = client.query.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE clubdesk_inventory_items'),
    );
    expect(updateCall[1]).toEqual(expect.arrayContaining(['07622202277795']));
  });

  test('brand-unique conflict skips brand only', async () => {
    const existing = { id: 4, brand: '', article_name: 'Same', category: '' };
    const client = {
      query: jest.fn(async (sql, params) => {
        if (String(sql).includes('lower(brand) = lower($4)')) {
          return { rows: [{ id: 99 }] };
        }
        if (String(sql).includes('UPDATE clubdesk_inventory_items')) return { rows: [] };
        return { rows: [] };
      }),
    };
    await mergeSeedIntoExisting(client, 1, existing, {
      brand: 'Nike',
      category: 'Food',
    });
    const updateCall = client.query.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE clubdesk_inventory_items'),
    );
    expect(updateCall[1]).toEqual(expect.arrayContaining(['Food']));
    expect(updateCall[1]).not.toEqual(expect.arrayContaining(['Nike']));
  });

  test('no overwrite of non-empty fields', async () => {
    const { updates } = buildFillEmptyUpdates(
      { brand: 'Locked', category: 'Old' },
      mapSeedToColumnValues({ brand: 'New', category: 'NewCat' }),
    );
    expect(updates).toEqual({});
  });
});
