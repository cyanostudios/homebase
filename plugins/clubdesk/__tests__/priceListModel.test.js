// plugins/clubdesk/__tests__/priceListModel.test.js
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Database: {
    get: jest.fn(),
  },
}));

const PriceListModel = require('../priceListModel');
const { AppError } = require('../../../server/core/errors/AppError');

describe('PriceListModel', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new PriceListModel();
  });

  test('transformListRow maps camelCase DTO without items', () => {
    expect(
      model.transformListRow({
        id: 7,
        title: 'Bar menu',
        slug: 'bar-menu',
        description: 'Drinks',
        featured_image_url: 'https://cdn.example/a.jpg',
        publication_status: 'published',
        currency: 'SEK',
        sort_order: 2,
        item_count: 3,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }),
    ).toEqual({
      id: '7',
      title: 'Bar menu',
      slug: 'bar-menu',
      description: 'Drinks',
      featuredImageUrl: null,
      publicationStatus: 'published',
      currency: 'SEK',
      sortOrder: 2,
      itemCount: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('normalizeItems assigns sequenceOrder per category and coerces price', () => {
    const items = model.normalizeItems([
      { title: 'Coffee', price: '12.50', category: 'Drinks' },
      { title: 'Tea' },
    ]);
    expect(items).toEqual([
      {
        title: 'Coffee',
        description: null,
        price: 12.5,
        category: 'Drinks',
        sequenceOrder: 1,
      },
      {
        title: 'Tea',
        description: null,
        price: 0,
        category: null,
        sequenceOrder: 1,
      },
    ]);
  });

  test('normalizeItems allows same sequenceOrder in different categories', () => {
    const items = model.normalizeItems([
      { title: 'A', sequenceOrder: 1, category: 'Drinks' },
      { title: 'B', sequenceOrder: 1, category: 'Food' },
    ]);
    expect(items).toEqual([
      expect.objectContaining({ title: 'A', category: 'Drinks', sequenceOrder: 1 }),
      expect.objectContaining({ title: 'B', category: 'Food', sequenceOrder: 1 }),
    ]);
  });

  test('normalizeItems renumbers duplicate sequenceOrder within category by payload order', () => {
    const items = model.normalizeItems([
      { title: 'A', sequenceOrder: 1, category: 'Drinks' },
      { title: 'B', sequenceOrder: 1, category: 'Drinks' },
    ]);
    expect(items).toEqual([
      expect.objectContaining({ title: 'A', category: 'Drinks', sequenceOrder: 1 }),
      expect.objectContaining({ title: 'B', category: 'Drinks', sequenceOrder: 2 }),
    ]);
  });

  test('assertPublishedHasItems rejects published with zero items', () => {
    expect(() => model.assertPublishedHasItems('published', 0)).toThrow(AppError);
    try {
      model.assertPublishedHasItems('published', 0);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(AppError.CODES.VALIDATION_ERROR);
      expect(error.message).toMatch(/at least one item/i);
      expect(error.details).toEqual([
        { field: 'items', message: 'Add at least one item before publishing.' },
      ]);
    }
  });

  test('assertPublishedHasItems allows draft with zero items', () => {
    expect(() => model.assertPublishedHasItems('draft', 0)).not.toThrow();
  });

  test('create rejects published price list with zero items', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      transaction: jest.fn(),
    });

    await expect(
      model.create(
        {},
        {
          title: 'Bar',
          slug: 'bar',
          publicationStatus: 'published',
          items: [],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
      details: [{ field: 'items', message: 'Add at least one item before publishing.' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('create allows draft price list with zero items', async () => {
    const { Database } = require('@homebase/core');
    const txQuery = jest.fn(async (sql) => {
      if (String(sql).includes('INSERT INTO clubdesk_price_lists')) {
        return [
          {
            id: 42,
            title: 'Bar',
            slug: 'bar',
            description: null,
            featured_image_url: null,
            publication_status: 'draft',
            currency: 'SEK',
            sort_order: 1,
            created_at: 'a',
            updated_at: 'b',
          },
        ];
      }
      if (String(sql).includes('FROM clubdesk_price_list_items')) {
        return [];
      }
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => []),
      transaction: async (fn) => fn({ query: txQuery }),
    });

    const created = await model.create(
      {},
      {
        title: 'Bar',
        slug: 'bar',
        publicationStatus: 'draft',
        items: [],
      },
    );
    expect(created.publicationStatus).toBe('draft');
    expect(created.currency).toBe('SEK');
    expect(created.items).toEqual([]);
    expect(created.itemCount).toBe(0);
  });

  test('deleteCategory deletes catalog row only when no items match', async () => {
    const { Database } = require('@homebase/core');
    const poolQuery = jest.fn(async (sql) => {
      const text = String(sql);
      if (text.includes('SELECT id, name')) {
        return { rows: [{ id: 9, name: 'Drinks' }] };
      }
      if (text.includes('COUNT(*)')) {
        return { rows: [{ cnt: 0 }] };
      }
      if (text.includes('DELETE FROM clubdesk_price_list_item_categories')) {
        return { rows: [{ id: 9 }] };
      }
      return { rows: [] };
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => [{ id: 3 }]),
      getPool: () => ({ query: poolQuery }),
      transaction: async (fn) =>
        fn({
          query: async (sql, params) => {
            const result = await poolQuery(sql, params);
            return result.rows;
          },
        }),
    });

    await expect(model.deleteCategory({}, 3, 9)).resolves.toEqual({
      id: '9',
      movedItemCount: 0,
      moveToCategory: null,
    });
  });

  test('deleteCategory with items requires moveToCategory', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => [{ id: 3 }]),
      getPool: () => ({
        query: jest.fn(async (sql) => {
          const text = String(sql);
          if (text.includes('SELECT id, name')) {
            return { rows: [{ id: 9, name: 'Drinks' }] };
          }
          if (text.includes('COUNT(*)')) {
            return { rows: [{ cnt: 2 }] };
          }
          return { rows: [] };
        }),
      }),
    });

    await expect(model.deleteCategory({}, 3, 9)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  test('deleteCategory reassigns items then deletes catalog', async () => {
    const { Database } = require('@homebase/core');
    const queries = [];
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => [{ id: 3 }]),
      getPool: () => ({
        query: jest.fn(async (sql) => {
          const text = String(sql);
          if (text.includes('SELECT id, name')) {
            return { rows: [{ id: 9, name: 'Drinks' }] };
          }
          if (text.includes('COUNT(*)')) {
            return { rows: [{ cnt: 2 }] };
          }
          return { rows: [] };
        }),
      }),
      transaction: async (fn) =>
        fn({
          query: async (sql, params) => {
            queries.push({ sql: String(sql), params });
            if (String(sql).includes('UPDATE')) {
              return [];
            }
            if (String(sql).includes('DELETE')) {
              return [{ id: 9 }];
            }
            return [];
          },
        }),
    });

    await expect(model.deleteCategory({}, 3, 9, { moveToCategory: 'Food' })).resolves.toEqual({
      id: '9',
      movedItemCount: 2,
      moveToCategory: 'Food',
    });
    expect(queries.some((q) => /UPDATE\s+clubdesk_price_list_items/i.test(q.sql))).toBe(true);
    expect(
      queries.some((q) => /DELETE FROM clubdesk_price_list_item_categories/i.test(q.sql)),
    ).toBe(true);
  });
});
