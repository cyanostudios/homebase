// plugins/clubdesk/__tests__/model.test.js
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

const ClubdeskModel = require('../model');
const { AppError } = require('../../../server/core/errors/AppError');

describe('ClubdeskModel', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new ClubdeskModel();
  });

  test('transformListRow maps camelCase DTO without steps', () => {
    expect(
      model.transformListRow({
        id: 7,
        title: 'How to brew',
        slug: 'how-to-brew',
        description: 'Intro',
        featured_image_url: 'https://cdn.example/a.jpg',
        category: 'Kitchen',
        publication_status: 'published',
        featured: true,
        sort_order: 2,
        step_count: 3,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      }),
    ).toEqual({
      id: '7',
      title: 'How to brew',
      slug: 'how-to-brew',
      description: 'Intro',
      featuredImageUrl: 'https://cdn.example/a.jpg',
      category: 'Kitchen',
      publicationStatus: 'published',
      featured: true,
      sortOrder: 2,
      stepCount: 3,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('getAll SELECT includes featured for list reload', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn().mockResolvedValue([]);
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
    });
    await model.getAll({});
    expect(query).toHaveBeenCalled();
    const sql = String(query.mock.calls[0][0]);
    expect(sql).toMatch(/i\.featured\b/);
  });

  test('transformDetailRow includes ordered steps', () => {
    const detail = model.transformDetailRow(
      {
        id: 1,
        title: 'T',
        slug: 't',
        description: null,
        featured_image_url: null,
        category: null,
        publication_status: 'draft',
        created_at: 'a',
        updated_at: 'b',
      },
      [
        {
          id: 10,
          guide_id: 1,
          title: 'Step A',
          description: 'Do A',
          sequence_order: 1,
          image_url: null,
          created_at: 'a',
          updated_at: 'b',
        },
      ],
    );

    expect(detail.stepCount).toBe(1);
    expect(detail.steps).toEqual([
      {
        id: '10',
        clubdeskId: '1',
        title: 'Step A',
        description: 'Do A',
        sequenceOrder: 1,
        imageUrl: null,
        createdAt: 'a',
        updatedAt: 'b',
      },
    ]);
  });

  test('normalizeSteps assigns sequenceOrder from index when omitted', () => {
    const steps = model.normalizeSteps([{ title: 'One' }, { title: 'Two' }]);
    expect(steps).toEqual([
      { title: 'One', description: null, sequenceOrder: 1, imageUrl: null },
      { title: 'Two', description: null, sequenceOrder: 2, imageUrl: null },
    ]);
  });

  test('normalizeSteps rejects duplicate sequenceOrder', () => {
    expect(() =>
      model.normalizeSteps([
        { title: 'A', sequenceOrder: 1 },
        { title: 'B', sequenceOrder: 1 },
      ]),
    ).toThrow(/Duplicate sequenceOrder/);
  });

  test('normalizeSteps returns null when steps omitted', () => {
    expect(model.normalizeSteps(undefined)).toBeNull();
    expect(model.normalizeSteps(null)).toBeNull();
  });

  test('normalizeSteps allows empty array (zero steps)', () => {
    expect(model.normalizeSteps([])).toEqual([]);
  });

  test('assertPublishedHasSteps rejects published with zero steps', () => {
    expect(() => model.assertPublishedHasSteps('published', 0)).toThrow(AppError);
    try {
      model.assertPublishedHasSteps('published', 0);
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(AppError.CODES.VALIDATION_ERROR);
      expect(error.message).toMatch(/at least one step/i);
      expect(error.details).toEqual([
        { field: 'steps', message: 'Add at least one step before publishing.' },
      ]);
    }
  });

  test('assertPublishedHasSteps allows draft with zero steps', () => {
    expect(() => model.assertPublishedHasSteps('draft', 0)).not.toThrow();
  });

  test('assertPublishedHasSteps allows published with at least one step', () => {
    expect(() => model.assertPublishedHasSteps('published', 1)).not.toThrow();
  });

  test('create rejects published clubdesk with zero steps', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      transaction: jest.fn(),
    });

    await expect(
      model.create(
        {},
        {
          title: 'Brew',
          slug: 'brew',
          publicationStatus: 'published',
          steps: [],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
      details: [{ field: 'steps', message: 'Add at least one step before publishing.' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('create allows draft clubdesk with zero steps', async () => {
    const { Database } = require('@homebase/core');
    const txQuery = jest.fn(async (sql) => {
      if (String(sql).includes('INSERT INTO clubdesk_guides')) {
        return [
          {
            id: 42,
            title: 'Brew',
            slug: 'brew',
            description: null,
            featured_image_url: null,
            category: null,
            publication_status: 'draft',
            created_at: 'a',
            updated_at: 'b',
          },
        ];
      }
      if (String(sql).includes('FROM clubdesk_guide_steps')) {
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
        title: 'Brew',
        slug: 'brew',
        publicationStatus: 'draft',
        steps: [],
      },
    );
    expect(created.publicationStatus).toBe('draft');
    expect(created.steps).toEqual([]);
    expect(created.stepCount).toBe(0);
  });

  test('create rejects duplicate title', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => [{ id: 9 }]),
      transaction: jest.fn(),
    });

    await expect(
      model.create(
        {},
        {
          title: 'Brew',
          slug: 'brew-2',
          publicationStatus: 'draft',
          steps: [],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
      details: [{ field: 'title', message: 'A guide with this title already exists' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('create rejects reserved slug price-list', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(),
      transaction: jest.fn(),
    });

    await expect(
      model.create(
        {},
        {
          title: 'Brew',
          slug: 'Price-List',
          publicationStatus: 'draft',
          steps: [],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
      details: [{ field: 'slug', message: 'slug "price-list" is reserved' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('create rejects reserved slug info', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(),
      transaction: jest.fn(),
    });

    await expect(
      model.create(
        {},
        {
          title: 'About',
          slug: 'Info',
          publicationStatus: 'draft',
          steps: [],
        },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
      details: [{ field: 'slug', message: 'slug "info" is reserved' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('update rejects when another clubdesk already has the title', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn(async (sql, params) => {
      if (String(sql).includes('SELECT * FROM clubdesk_guides WHERE id')) {
        return [
          {
            id: 7,
            title: 'Brew',
            slug: 'brew',
            description: null,
            featured_image_url: null,
            category: null,
            publication_status: 'draft',
            created_at: 'a',
            updated_at: 'b',
          },
        ];
      }
      if (String(sql).includes('FROM clubdesk_guide_steps')) {
        return [
          {
            id: 1,
            guide_id: 7,
            title: 'S1',
            description: null,
            sequence_order: 1,
            image_url: null,
            created_at: 'a',
            updated_at: 'b',
          },
        ];
      }
      // assertTitleUnique: another row owns the new title
      if (String(sql).includes('lower(title)') && params?.[2] === 7) {
        return [{ id: 9 }];
      }
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
      getPool: () => ({ query: jest.fn(async () => ({ rows: [] })) }),
      transaction: jest.fn(),
    });

    await expect(
      model.update({}, 7, {
        title: 'Other Guide',
        slug: 'brew',
        publicationStatus: 'draft',
        steps: [{ title: 'S1', sequenceOrder: 1 }],
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
      details: [{ field: 'title', message: 'A guide with this title already exists' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('update allows keeping the same title on the same clubdesk (excludeId)', async () => {
    const { Database } = require('@homebase/core');
    const parentRow = {
      id: 7,
      title: 'Brew',
      slug: 'brew',
      description: null,
      featured_image_url: null,
      category: null,
      publication_status: 'draft',
      created_at: 'a',
      updated_at: 'b',
    };
    const stepRow = {
      id: 1,
      guide_id: 7,
      title: 'S1',
      description: null,
      sequence_order: 1,
      image_url: null,
      created_at: 'a',
      updated_at: 'b',
    };
    const query = jest.fn(async (sql) => {
      if (String(sql).includes('SELECT * FROM clubdesk_guides WHERE id')) {
        return [parentRow];
      }
      if (String(sql).includes('FROM clubdesk_guide_steps')) {
        return [stepRow];
      }
      // assertTitleUnique with excludeId — no other row
      if (String(sql).includes('lower(title)')) {
        return [];
      }
      return [];
    });
    const txQuery = jest.fn(async (sql) => {
      if (String(sql).includes('UPDATE')) {
        return [parentRow];
      }
      if (String(sql).includes('DELETE FROM')) {
        return [];
      }
      if (String(sql).includes('INSERT INTO clubdesk_guide_steps')) {
        return [];
      }
      if (String(sql).includes('FROM clubdesk_guide_steps')) {
        return [stepRow];
      }
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
      getPool: () => ({
        query: jest.fn(async () => ({ rows: [stepRow] })),
      }),
      transaction: async (fn) => fn({ query: txQuery }),
    });

    const updated = await model.update({}, 7, {
      title: 'Brew',
      slug: 'brew',
      publicationStatus: 'draft',
      steps: [{ title: 'S1', sequenceOrder: 1 }],
    });
    expect(updated.title).toBe('Brew');
    expect(updated.id).toBe('7');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('lower(title)'),
      expect.arrayContaining([1, 'Brew', 7]),
    );
  });

  test('update rejects publishing when existing steps are empty and steps omitted', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async (sql) => {
        if (String(sql).includes('SELECT * FROM clubdesk_guides')) {
          return [
            {
              id: 7,
              title: 'Brew',
              slug: 'brew',
              description: null,
              featured_image_url: null,
              category: null,
              publication_status: 'draft',
              created_at: 'a',
              updated_at: 'b',
            },
          ];
        }
        if (String(sql).includes('FROM clubdesk_guide_steps')) {
          return [];
        }
        return [];
      }),
      getPool: () => ({
        query: jest.fn(async () => ({ rows: [] })),
      }),
      transaction: jest.fn(),
    });

    await expect(
      model.update({}, 7, {
        title: 'Brew',
        slug: 'brew',
        publicationStatus: 'published',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
      details: [{ field: 'steps', message: 'Add at least one step before publishing.' }],
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('transformCategoryRow maps camelCase DTO', () => {
    expect(
      model.transformCategoryRow({
        id: 3,
        name: 'Kitchen',
        sort_order: 2,
        created_at: 'a',
        updated_at: 'b',
      }),
    ).toEqual({
      id: '3',
      name: 'Kitchen',
      sortOrder: 2,
      createdAt: 'a',
      updatedAt: 'b',
    });
  });

  test('createCategory rejects empty name', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(),
    });

    await expect(model.createCategory({}, { name: '  ' })).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
      details: [{ field: 'name', message: 'Category name is required' }],
    });
  });

  test('createCategory rejects duplicate name', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => [{ id: 2 }]),
    });

    await expect(model.createCategory({}, { name: 'Kitchen' })).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
      details: [{ field: 'name', message: 'Category name already exists' }],
    });
  });

  test('reorderCategories rejects incomplete orderedIds', async () => {
    const { Database } = require('@homebase/core');
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query: jest.fn(async () => [{ id: 1 }, { id: 2 }]),
      transaction: jest.fn(),
    });

    await expect(model.reorderCategories({}, ['1'])).rejects.toMatchObject({
      statusCode: 400,
      code: AppError.CODES.VALIDATION_ERROR,
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('deleteCategory deletes catalog row only when no guides match', async () => {
    const { Database } = require('@homebase/core');
    const queries = [];
    const query = jest.fn(async (sql, params) => {
      queries.push({ sql: String(sql), params });
      if (/SELECT id, name/i.test(sql)) {
        return [{ id: 9, name: 'Ops' }];
      }
      if (/COUNT\(\*\)/i.test(sql)) {
        return [{ cnt: 0 }];
      }
      if (/DELETE FROM clubdesk_guide_categories/i.test(sql)) {
        expect(String(sql)).toMatch(/user_id/);
        return [{ id: 9 }];
      }
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
      transaction: async (fn) => fn({ query }),
    });

    await expect(model.deleteCategory({}, 9)).resolves.toEqual({
      id: '9',
      movedItemCount: 0,
      moveToCategory: null,
    });
    expect(queries.some((q) => /DELETE FROM clubdesk_guide_categories/i.test(q.sql))).toBe(true);
  });

  test('deleteCategory with guides requires moveToCategory', async () => {
    const { Database } = require('@homebase/core');
    const query = jest.fn(async (sql) => {
      if (/SELECT id, name/i.test(sql)) {
        return [{ id: 9, name: 'Ops' }];
      }
      if (/COUNT\(\*\)/i.test(sql)) {
        return [{ cnt: 2 }];
      }
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
      transaction: jest.fn(),
    });

    await expect(model.deleteCategory({}, 9)).rejects.toMatchObject({
      statusCode: 409,
      code: AppError.CODES.CONFLICT,
    });
    expect(Database.get().transaction).not.toHaveBeenCalled();
  });

  test('deleteCategory reassigns guides then deletes catalog', async () => {
    const { Database } = require('@homebase/core');
    const queries = [];
    const query = jest.fn(async (sql, params) => {
      queries.push({ sql: String(sql), params });
      if (/SELECT id, name/i.test(sql)) {
        return [{ id: 9, name: 'Ops' }];
      }
      if (/COUNT\(\*\)/i.test(sql)) {
        return [{ cnt: 2 }];
      }
      if (/UPDATE\s+clubdesk_guides/i.test(sql)) {
        return [];
      }
      if (/DELETE FROM clubdesk_guide_categories/i.test(sql)) {
        return [{ id: 9 }];
      }
      return [];
    });
    Database.get.mockReturnValue({
      getUserId: () => 1,
      query,
      transaction: async (fn) => fn({ query }),
    });

    await expect(model.deleteCategory({}, 9, { moveToCategory: 'Kitchen' })).resolves.toEqual({
      id: '9',
      movedItemCount: 2,
      moveToCategory: 'Kitchen',
    });
    expect(queries.some((q) => /UPDATE\s+clubdesk_guides/i.test(q.sql))).toBe(true);
    expect(queries.some((q) => /DELETE FROM clubdesk_guide_categories/i.test(q.sql))).toBe(true);
  });
});
