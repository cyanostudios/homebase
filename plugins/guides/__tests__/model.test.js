// plugins/guides/__tests__/model.test.js
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

const { Database } = require('@homebase/core');
const GuidesModel = require('../model');

describe('GuidesModel', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
  });

  test('transformRow maps place and master guide fields', () => {
    const result = model.transformRow(
      {
        id: 1,
        display_name: 'Museum',
        short_intro: 'Intro',
        geographic_reference: 'Stockholm',
        lifecycle_status: 'draft',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      {
        id: 10,
        source_language: 'sv',
        editorial_status: 'draft',
      },
    );

    expect(result).toEqual({
      id: '1',
      displayName: 'Museum',
      shortIntro: 'Intro',
      geographicReference: 'Stockholm',
      lifecycleStatus: 'draft',
      ingestSourceId: null,
      ingestRunId: null,
      masterGuideId: '10',
      sourceLanguage: 'sv',
      masterGuideEditorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('create inserts place with user_id and master guide in a transaction', async () => {
    const tx = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 1,
            user_id: 7,
            display_name: 'Museum',
            short_intro: null,
            geographic_reference: null,
            lifecycle_status: 'draft',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ])
        .mockResolvedValueOnce([
          {
            id: 10,
            place_id: 1,
            source_language: 'sv',
            editorial_status: 'draft',
          },
        ]),
    };

    Database.get.mockReturnValue({
      getUserId: jest.fn().mockReturnValue(7),
      transaction: jest.fn(async (callback) => callback(tx)),
    });

    const result = await model.create({}, { displayName: 'Museum', sourceLanguage: 'sv' });

    expect(Database.get).toHaveBeenCalled();
    expect(tx.query).toHaveBeenCalledTimes(2);
    expect(tx.query.mock.calls[0][1]).toEqual([7, 'Museum', null, null, 'draft']);
    expect(result.masterGuideId).toBe('10');
    expect(result.displayName).toBe('Museum');
    expect(result.sourceLanguage).toBe('sv');
  });

  test('create requires user context', async () => {
    Database.get.mockReturnValue({
      getUserId: jest.fn().mockReturnValue(null),
    });

    await expect(model.create({}, { displayName: 'Museum' })).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  test('delete returns not found when place is missing', async () => {
    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValue([]),
    });

    await expect(model.delete({}, '99')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('update updates master guide fields when provided', async () => {
    const existingPlace = {
      id: 1,
      display_name: 'Museum',
      short_intro: null,
      geographic_reference: null,
      lifecycle_status: 'draft',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      master_guide_id: 10,
      source_language: 'sv',
      master_editorial_status: 'draft',
    };

    const query = jest
      .fn()
      .mockResolvedValueOnce([existingPlace])
      .mockResolvedValueOnce([
        {
          ...existingPlace,
          display_name: 'Updated Museum',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          place_id: 1,
          source_language: 'en',
          editorial_status: 'in-progress',
        },
      ]);

    Database.get.mockReturnValue({ query });

    const result = await model.update({}, '1', {
      displayName: 'Updated Museum',
      sourceLanguage: 'en',
      masterGuideEditorialStatus: 'in-progress',
    });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][0]).toContain('UPDATE guide_master_guides mg');
    expect(query.mock.calls[2][1]).toEqual(['en', 'in-progress', '1']);
    expect(result.displayName).toBe('Updated Museum');
    expect(result.sourceLanguage).toBe('en');
    expect(result.masterGuideEditorialStatus).toBe('in-progress');
  });

  test('update leaves master guide unchanged when master fields omitted', async () => {
    const existingPlace = {
      id: 1,
      display_name: 'Museum',
      short_intro: null,
      geographic_reference: null,
      lifecycle_status: 'draft',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      master_guide_id: 10,
      source_language: 'sv',
      master_editorial_status: 'draft',
    };

    const query = jest
      .fn()
      .mockResolvedValueOnce([existingPlace])
      .mockResolvedValueOnce([
        {
          ...existingPlace,
          display_name: 'Updated Museum',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 10,
          place_id: 1,
          source_language: 'sv',
          editorial_status: 'draft',
        },
      ]);

    Database.get.mockReturnValue({ query });

    const result = await model.update({}, '1', {
      displayName: 'Updated Museum',
    });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2][0]).toContain('SELECT mg.*');
    expect(query.mock.calls[2][0]).not.toContain('UPDATE guide_master_guides');
    expect(result.sourceLanguage).toBe('sv');
    expect(result.masterGuideEditorialStatus).toBe('draft');
  });
});
