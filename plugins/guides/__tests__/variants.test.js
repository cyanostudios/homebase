// plugins/guides/__tests__/variants.test.js
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

describe('GuidesModel guide variants', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
  });

  test('transformVariantRow maps variant fields', () => {
    const result = model.transformVariantRow(
      {
        id: 7,
        stop_id: 5,
        variant_type: 'quick',
        language: 'sv',
        presentation_text: 'Short intro',
        publication_status: 'draft',
        staleness_status: 'fresh',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      '1',
      '5',
    );

    expect(result).toEqual({
      id: '7',
      stopId: '5',
      placeId: '1',
      variantType: 'quick',
      language: 'sv',
      presentationText: 'Short intro',
      publicationStatus: 'draft',
      stalenessStatus: 'fresh',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('createStop auto-creates default variants for source language', async () => {
    const tx = {
      query: jest
        .fn()
        .mockResolvedValueOnce([{ next_order: 1 }])
        .mockResolvedValueOnce([
          {
            id: 5,
            master_guide_id: 10,
            title: 'Hall',
            sequence_order: 1,
            canonical_narrative: null,
            editorial_status: 'draft',
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ])
        .mockResolvedValue([]),
    };

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([{ id: 10, source_language: 'sv' }]),
      transaction: jest.fn(async (callback) => callback(tx)),
    });

    await model.createStop({}, '1', { title: 'Hall' });

    expect(tx.query).toHaveBeenCalledTimes(5);
    expect(tx.query.mock.calls[2][1]).toEqual([5, 'quick', 'sv', 'draft', 'fresh']);
    expect(tx.query.mock.calls[3][1]).toEqual([5, 'normal', 'sv', 'draft', 'fresh']);
    expect(tx.query.mock.calls[4][1]).toEqual([5, 'deep', 'sv', 'draft', 'fresh']);
  });

  test('updateStop marks variants stale when canonicalNarrative changes', async () => {
    const existingStop = {
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Hall',
      sequenceOrder: 1,
      canonicalNarrative: 'Old narrative',
      editorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    jest.spyOn(model, 'getStopById').mockResolvedValue(existingStop);

    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 5,
          master_guide_id: 10,
          title: 'Hall',
          sequence_order: 1,
          canonical_narrative: 'New narrative',
          editorial_status: 'draft',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);

    Database.get.mockReturnValue({ query });

    await model.updateStop({}, '1', '5', { canonicalNarrative: 'New narrative' });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1][0]).toContain("staleness_status = 'stale'");
    expect(query.mock.calls[1][1]).toEqual(['5', '1']);
  });

  test('updateStop does not mark variants stale when canonicalNarrative unchanged', async () => {
    const existingStop = {
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Hall',
      sequenceOrder: 1,
      canonicalNarrative: 'Same narrative',
      editorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    jest.spyOn(model, 'getStopById').mockResolvedValue(existingStop);

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 5,
          master_guide_id: 10,
          title: 'Main Hall',
          sequence_order: 1,
          canonical_narrative: 'Same narrative',
          editorial_status: 'draft',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    await model.updateStop({}, '1', '5', { title: 'Main Hall' });

    expect(Database.get.mock.results[0].value.query).toHaveBeenCalledTimes(1);
  });

  test('getVariants returns tenant-scoped variants', async () => {
    jest.spyOn(model, 'getStopById').mockResolvedValue({
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Hall',
      sequenceOrder: 1,
      canonicalNarrative: null,
      editorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 7,
          stop_id: 5,
          variant_type: 'normal',
          language: 'sv',
          presentation_text: null,
          publication_status: 'draft',
          staleness_status: 'fresh',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.getVariants({}, '1', '5');

    expect(result).toHaveLength(1);
    expect(result[0].variantType).toBe('normal');
    expect(Database.get.mock.results[0].value.query.mock.calls[0][1]).toEqual(['5', '1']);
  });

  test('createVariant inserts variant and maps duplicate to conflict', async () => {
    jest.spyOn(model, 'getStopById').mockResolvedValue({
      id: '5',
      masterGuideId: '10',
      placeId: '1',
      title: 'Hall',
      sequenceOrder: 1,
      canonicalNarrative: null,
      editorialStatus: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 8,
          stop_id: 5,
          variant_type: 'quick',
          language: 'en',
          presentation_text: 'Hello',
          publication_status: 'ready',
          staleness_status: 'fresh',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.createVariant({}, '1', '5', {
      variantType: 'quick',
      language: 'en',
      presentationText: 'Hello',
      publicationStatus: 'ready',
    });

    expect(result.language).toBe('en');
    expect(result.publicationStatus).toBe('ready');

    Database.get.mockReturnValue({
      query: jest.fn().mockRejectedValueOnce({ code: '23505' }),
    });

    await expect(
      model.createVariant({}, '1', '5', {
        variantType: 'quick',
        language: 'en',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test('updateVariant updates presentation and publication status', async () => {
    jest.spyOn(model, 'getVariantById').mockResolvedValue({
      id: '7',
      stopId: '5',
      placeId: '1',
      variantType: 'normal',
      language: 'sv',
      presentationText: null,
      publicationStatus: 'draft',
      stalenessStatus: 'fresh',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 7,
          stop_id: 5,
          variant_type: 'normal',
          language: 'sv',
          presentation_text: 'Updated text',
          publication_status: 'published',
          staleness_status: 'fresh',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.updateVariant({}, '1', '5', '7', {
      presentationText: 'Updated text',
      publicationStatus: 'published',
    });

    expect(result.presentationText).toBe('Updated text');
    expect(result.publicationStatus).toBe('published');
  });

  test('deleteVariant returns not found when scoped delete misses', async () => {
    jest.spyOn(model, 'getVariantById').mockResolvedValue({
      id: '7',
      stopId: '5',
      placeId: '1',
      variantType: 'normal',
      language: 'sv',
      presentationText: null,
      publicationStatus: 'draft',
      stalenessStatus: 'fresh',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([]),
    });

    await expect(model.deleteVariant({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
