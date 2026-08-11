// plugins/public-clubdesk/__tests__/model.test.js
const PublicClubdeskModel = require('../model');

describe('PublicClubdeskModel', () => {
  let model;

  beforeEach(() => {
    model = new PublicClubdeskModel();
  });

  test('transformGuideListRow exposes public list fields', () => {
    expect(
      model.transformGuideListRow({
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
      featured: false,
      category: 'Home',
      stepCount: 4,
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  test('transformGuideListRow maps featured true', () => {
    expect(
      model.transformGuideListRow({
        id: 3,
        title: 'Feat',
        slug: 'feat',
        description: null,
        featured_image_url: null,
        featured: true,
        category: null,
        step_count: 1,
        updated_at: null,
      }).featured,
    ).toBe(true);
  });

  test('transformGuideDetail maps steps to public { number, title, description, image }', () => {
    const detail = model.transformGuideDetail(
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

  test('transformPriceListDetail maps items with price and category', () => {
    const detail = model.transformPriceListDetail(
      {
        id: 3,
        title: 'Bar',
        slug: 'bar',
        description: null,
        currency: 'SEK',
        updated_at: 't',
      },
      [
        {
          title: 'Beer',
          description: 'Draft',
          price: '45.00',
          category: 'Drinks',
          sequence_order: 1,
        },
      ],
    );

    expect(detail.currency).toBe('SEK');
    expect(detail.featuredImageUrl).toBeUndefined();
    expect(detail.items).toEqual([
      {
        title: 'Beer',
        description: 'Draft',
        price: 45,
        category: 'Drinks',
        sequenceOrder: 1,
      },
    ]);
  });

  test('listPublishedGuides filters by owner and published status', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPublishedGuides(pool, 42);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([42]);
    expect(sql).toMatch(/publication_status = 'published'/);
    expect(sql).toMatch(/g\.user_id = \$1/);
    expect(sql).toMatch(/clubdesk_guide_categories/);
  });

  test('listPublishedPriceLists filters by owner and published status', async () => {
    const pool = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.listPublishedPriceLists(pool, 7);
    const [sql, params] = pool.query.mock.calls[0];
    expect(params).toEqual([7]);
    expect(sql).toMatch(/clubdesk_price_lists/);
    expect(sql).toMatch(/publication_status = 'published'/);
  });

  test('getPublishedGuideBySlugOrId uses id when numeric', async () => {
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
              updated_at: 't',
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }),
    };
    await model.getPublishedGuideBySlugOrId(pool, 1, '9');
    expect(pool.query.mock.calls[0][1]).toEqual([1, 9]);
    expect(pool.query.mock.calls[0][0]).toMatch(/clubdesk_guides/);
  });

  test('sanitizePublicHtml strips scripts and event handlers', () => {
    const clean = model.sanitizePublicHtml(
      '<p onclick="alert(1)">Hi</p><script>evil()</script><a href="javascript:alert(1)">x</a>',
    );
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).toMatch(/<p>/);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toMatch(/Hi/);
  });

  test('getPublicSiteContent returns only home and info', async () => {
    const pool = {
      query: jest.fn().mockResolvedValue({
        rows: [
          { card_key: 'home', content: '<p>Hem</p>', meta: {} },
          { card_key: 'info', content: '<p>Info</p>', meta: { title: 'Om oss' } },
          { card_key: 'swish', content: 'secret', meta: {} },
        ],
      }),
    };
    const payload = await model.getPublicSiteContent(pool, 3);
    expect(payload).toEqual({
      home: { contentHtml: '<p>Hem</p>', title: '' },
      info: { contentHtml: '<p>Info</p>', title: 'Om oss' },
    });
    expect(pool.query.mock.calls[0][1]).toEqual([3]);
    expect(pool.query.mock.calls[0][0]).toMatch(/card_key IN \('home', 'info'\)/);
  });
});
