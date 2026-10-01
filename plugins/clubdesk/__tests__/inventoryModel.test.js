// plugins/clubdesk/__tests__/inventoryModel.test.js
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

const InventoryModel = require('../inventoryModel');
const { AppError } = require('../../../server/core/errors/AppError');
const { slugifyBase, normalizeInventoryTags, normalizeGtin } = require('../inventoryModel');

describe('InventoryModel', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new InventoryModel();
  });

  test('slugifyBase normalizes article names', () => {
    expect(slugifyBase('Match Kit 2026!')).toBe('match-kit-2026');
    expect(slugifyBase('')).toBe('item');
  });

  test('normalizeInventoryTags dedupes and caps', () => {
    expect(normalizeInventoryTags(['A', 'a', 'B', '', 1])).toEqual(['A', 'B']);
  });

  test('normalizeGtin accepts empty or 8, 12, 13, or 14 digits', () => {
    expect(normalizeGtin('')).toBe('');
    expect(normalizeGtin(' 07312345678901 ')).toBe('07312345678901');
    expect(() => normalizeGtin('123')).toThrow(AppError);
  });

  test('transformInventoryRow maps camelCase DTO including publication', () => {
    expect(
      model.transformInventoryRow({
        id: 9,
        article_name: 'Jacket',
        brand: 'Nike',
        description: 'Warm',
        material: 'poly',
        purchase_price: '100.00',
        recommended_price: '150.00',
        sale_price: '149.00',
        currency: 'SEK',
        comment: 'internal',
        tags: '["sale"]',
        slug: 'jacket',
        featured_image_url: 'https://cdn.example/j.jpg',
        publication_status: 'published',
        featured: true,
        sort_order: 2,
        variant_count: 3,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }),
    ).toEqual({
      id: '9',
      articleName: 'Jacket',
      brand: 'Nike',
      description: 'Warm',
      material: 'poly',
      purchasePrice: 100,
      recommendedPrice: 150,
      salePrice: 149,
      currency: 'SEK',
      comment: 'internal',
      tags: ['sale'],
      slug: 'jacket',
      featuredImageUrl: 'https://cdn.example/j.jpg',
      catalogKey: '',
      category: '',
      packageSize: '',
      packageUnit: '',
      gtin: '',
      articleNumber: '',
      ingredients: null,
      allergens: null,
      energyKcal100g: null,
      fatG100g: null,
      saturatedFatG100g: null,
      carbohydrateG100g: null,
      sugarG100g: null,
      proteinG100g: null,
      saltG100g: null,
      netContent: '',
      countryOfOrigin: '',
      countryOfManufacture: '',
      supplier: '',
      source: '',
      verifiedAt: null,
      dataStatus: '',
      publicationStatus: 'published',
      featured: true,
      archivedAt: null,
      sortOrder: 2,
      variants: [],
      totalQuantity: 0,
      variantCount: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('normalizeItemFields defaults publication to published and slugifies', () => {
    const fields = model.normalizeItemFields({ articleName: 'Training Tee' });
    expect(fields.publicationStatus).toBe('published');
    expect(fields.slug).toBe('training-tee');
    expect(fields.articleName).toBe('Training Tee');
  });

  test('normalizeItemFields rejects invalid publicationStatus', () => {
    expect(() =>
      model.normalizeItemFields({ articleName: 'X', publicationStatus: 'live' }),
    ).toThrow(AppError);
  });

  test('normalizeItemFields rejects changing catalogKey once set', () => {
    expect(() =>
      model.normalizeItemFields(
        { catalogKey: 'other' },
        { partial: true, existing: { catalogKey: 'seed-key' } },
      ),
    ).toThrow(AppError);
  });

  test('normalizeItemFields normalizes item gtin', () => {
    const fields = model.normalizeItemFields({ articleName: 'Bar', gtin: '1234567890123' });
    expect(fields.gtin).toBe('1234567890123');
  });

  test('getAll filters by user_id and joins variant counts', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn().mockResolvedValue([]);
    Database.get.mockReturnValue({
      getUserId: () => 11,
      query,
      getPool: () => ({ query: jest.fn().mockResolvedValue({ rows: [] }) }),
    });
    await model.getAll({});
    expect(query).toHaveBeenCalled();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/clubdesk_inventory_items/);
    expect(sql).toMatch(/i\.user_id = \$1/);
    expect(query.mock.calls[0][1]).toEqual([11]);
  });

  test('importItems returns success and failure counts', async () => {
    jest.spyOn(model, 'create').mockImplementation(async (_req, data) => {
      if (!data.articleName) {
        throw new AppError('articleName is required', 400, AppError.CODES.VALIDATION_ERROR);
      }
      return { id: '1' };
    });
    const result = await model.importItems({}, [
      { articleName: 'OK' },
      {},
      { articleName: 'Also OK' },
    ]);
    expect(result).toEqual({
      successCount: 2,
      failureCount: 1,
      failures: [{ index: 1, message: 'articleName is required' }],
    });
  });

  test('delete refuses an active article', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(),
    });
    jest.spyOn(model, 'getById').mockResolvedValue({ id: '5', archivedAt: null });
    await expect(model.delete({}, 5)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Cannot delete an inventory item that is not archived',
    });
  });

  test('delete refuses an archived article that is on a price list', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
    });
    jest
      .spyOn(model, 'getById')
      .mockResolvedValue({ id: '5', archivedAt: '2026-09-30T00:00:00.000Z' });
    await expect(model.delete({}, 5)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Cannot delete inventory item while it is linked to a price list',
    });
    expect(String(query.mock.calls[0][0])).toMatch(/clubdesk_price_list_items/);
  });

  test('archive sets archived_at once', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn().mockResolvedValue([]);
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
    });
    const archived = { id: '5', archivedAt: '2026-09-30T00:00:00.000Z' };
    jest
      .spyOn(model, 'getById')
      .mockResolvedValueOnce({ id: '5', archivedAt: null })
      .mockResolvedValueOnce(archived);
    await expect(model.archive({}, 5)).resolves.toEqual(archived);
    expect(String(query.mock.calls[0][0])).toMatch(/archived_at = CURRENT_TIMESTAMP/);
  });
});
