// plugins/public-instructions/__tests__/model.test.js
const PublicInstructionsModel = require('../model');

describe('PublicInstructionsModel', () => {
  let model;

  beforeEach(() => {
    model = new PublicInstructionsModel();
  });

  test('transformListRow exposes public list fields', () => {
    expect(
      model.transformListRow({
        id: 2,
        title: 'Public',
        slug: 'public',
        description: 'Desc',
        featured_image_url: 'https://cdn.example/x.png',
        category: 'Home',
        step_count: 4,
        updated_at: '2026-08-01T00:00:00.000Z',
        publication_status: 'published',
        user_id: 99,
      }),
    ).toEqual({
      id: '2',
      title: 'Public',
      slug: 'public',
      description: 'Desc',
      featuredImageUrl: 'https://cdn.example/x.png',
      category: 'Home',
      stepCount: 4,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  test('transformDetail maps steps to public { number, title, description, image }', () => {
    const detail = model.transformDetail(
      {
        id: 5,
        title: 'Guide',
        slug: 'guide',
        description: null,
        featured_image_url: null,
        category: null,
        updated_at: 't',
      },
      [
        {
          sequence_order: 1,
          title: 'First',
          description: 'Do this',
          image_url: 'https://cdn.example/1.jpg',
        },
      ],
    );

    expect(detail.steps).toEqual([
      {
        number: 1,
        title: 'First',
        description: 'Do this',
        image: 'https://cdn.example/1.jpg',
      },
    ]);
  });

  test('listPublished filters by owner and published status', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPublished(pool, 42);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([42]);
    expect(sql).toMatch(/publication_status = 'published'/);
    expect(sql).toMatch(/i\.user_id = \$1/);
    expect(sql).toMatch(/instruction_categories/);
  });

  test('listCategoryOrder scopes by owner', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({ rows: [{ name: 'Kitchen' }, { name: ' Bar ' }] }),
    };
    const names = await model.listCategoryOrder(pool, 7);
    expect(names).toEqual(['Kitchen', 'Bar']);
    expect(pool.query.mock.calls[0][1]).toEqual([7]);
  });

  test('getPublishedBySlugOrId uses id when numeric', async () => {
    const pool = {
      query: jest
        .fn()
        .mockResolvedValueOnce({
          rows: [
            {
              id: 9,
              title: 'T',
              slug: 't',
              description: null,
              featured_image_url: null,
              category: null,
              updated_at: null,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };
    await model.getPublishedBySlugOrId(pool, 1, '9');
    expect(pool.query.mock.calls[0][1]).toEqual([1, 9]);
    expect(pool.query.mock.calls[0][0]).toMatch(/WHERE id = \$2/);
  });

  test('getPublishedBySlugOrId uses slug when non-numeric', async () => {
    const pool = {
      query: jest.fn().mockResolvedValueOnce({ rows: [] }),
    };
    const result = await model.getPublishedBySlugOrId(pool, 1, 'how-to-brew');
    expect(result).toBeNull();
    expect(pool.query.mock.calls[0][1]).toEqual([1, 'how-to-brew']);
    expect(pool.query.mock.calls[0][0]).toMatch(/lower\(slug\) = lower\(\$2\)/);
  });
});
