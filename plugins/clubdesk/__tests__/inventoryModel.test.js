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
const { slugifyBase, normalizeInventoryTags } = require('../inventoryModel');

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
      publicationStatus: 'published',
      featured: true,
      sortOrder: 2,
      variants: [],
      totalQuantity: 0,
      variantCount: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('normalizeItemFields defaults publication to draft and slugifies', () => {
    const fields = model.normalizeItemFields({ articleName: 'Training Tee' });
    expect(fields.publicationStatus).toBe('draft');
    expect(fields.slug).toBe('training-tee');
    expect(fields.articleName).toBe('Training Tee');
  });

  test('normalizeItemFields rejects invalid publicationStatus', () => {
    expect(() =>
      model.normalizeItemFields({ articleName: 'X', publicationStatus: 'live' }),
    ).toThrow(AppError);
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
});
