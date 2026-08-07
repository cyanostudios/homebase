// plugins/clubdesk/__tests__/siteContentModel.test.js
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

const SiteContentModel = require('../siteContentModel');
const { AppError } = require('../../../server/core/errors/AppError');
const { Database } = require('@homebase/core');

describe('SiteContentModel', () => {
  let model;

  beforeEach(() => {
    model = new SiteContentModel();
    jest.clearAllMocks();
  });

  test('getAll returns empty cards when no rows', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn().mockResolvedValue([]),
    });
    const cards = await model.getAll({});
    expect(cards.home).toMatchObject({ cardKey: 'home', content: '' });
    expect(cards.info).toMatchObject({ cardKey: 'info', content: '' });
    expect(cards.swish).toMatchObject({ cardKey: 'swish', content: '' });
  });

  test('assertCardKey rejects unknown keys', () => {
    expect(() => model.assertCardKey('qr')).toThrow(AppError);
    try {
      model.assertCardKey('qr');
    } catch (e) {
      expect(e.statusCode).toBe(400);
      expect(e.details[0].field).toBe('cardKey');
    }
  });

  test('upsert home stores HTML content', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        card_key: 'home',
        content: '<p>Hej</p>',
        meta: {},
        updated_at: '2026-08-07T12:00:00.000Z',
      },
    ]);
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query,
    });
    const card = await model.upsert({}, 'home', { content: '<p>Hej</p>' });
    expect(card).toEqual({
      cardKey: 'home',
      content: '<p>Hej</p>',
      meta: {},
      updatedAt: '2026-08-07T12:00:00.000Z',
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO clubdesk_site_content'),
      [7, 'home', '<p>Hej</p>', '{}'],
    );
  });

  test('upsert swish forces empty content and ignores Type C meta', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        card_key: 'swish',
        content: '',
        meta: {},
        updated_at: null,
      },
    ]);
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query,
    });
    const card = await model.upsert({}, 'swish', {
      content: '<p>nope</p>',
      meta: { payee: '070-123 45 67', amount: 100, message: 'Faktura 1' },
    });
    expect(card.content).toBe('');
    expect(card.meta).toEqual({});
    expect(query.mock.calls[0][1][2]).toBe('');
    expect(query.mock.calls[0][1][3]).toBe('{}');
  });

  test('upsertMany rejects duplicate cardKey', async () => {
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query: jest.fn(),
    });
    await expect(
      model.upsertMany({}, [
        { cardKey: 'home', content: 'a' },
        { cardKey: 'home', content: 'b' },
      ]),
    ).rejects.toMatchObject({
      statusCode: 400,
      details: [{ field: 'cards' }],
    });
  });

  test('upsert info stores title in meta', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        card_key: 'info',
        content: '<p>Body</p>',
        meta: { title: 'Om appen' },
        updated_at: null,
      },
    ]);
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query,
    });
    const card = await model.upsert({}, 'info', {
      content: '<p>Body</p>',
      meta: { title: '  Om appen  ' },
    });
    expect(card.meta).toEqual({ title: 'Om appen' });
    expect(query.mock.calls[0][1][3]).toBe(JSON.stringify({ title: 'Om appen' }));
  });

  test('upsert home stores title in meta', async () => {
    const query = jest.fn().mockResolvedValue([
      {
        card_key: 'home',
        content: '<p>Hej</p>',
        meta: { title: 'Välkommen' },
        updated_at: null,
      },
    ]);
    Database.get.mockReturnValue({
      getUserId: () => 7,
      query,
    });
    const card = await model.upsert({}, 'home', {
      content: '<p>Hej</p>',
      meta: { title: 'Välkommen' },
    });
    expect(card.meta).toEqual({ title: 'Välkommen' });
  });
});
