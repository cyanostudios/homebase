// plugins/guides/__tests__/audio.test.js
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
const { AppError } = require('../../../server/core/errors/AppError');
const GuidesModel = require('../model');

describe('GuidesModel guide audio', () => {
  let model;

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
  });

  test('transformAudioRow maps audio fields', () => {
    const result = model.transformAudioRow(
      {
        id: 12,
        variant_presentation_id: 7,
        status: 'ready',
        provider_key: 'noop',
        storage_ref: 'audio/stop-7.mp3',
        duration_ms: 45000,
        mime_type: 'audio/mpeg',
        error_message: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
      '1',
      '5',
      '7',
    );

    expect(result).toEqual({
      id: '12',
      variantId: '7',
      stopId: '5',
      placeId: '1',
      status: 'ready',
      providerKey: 'noop',
      storageRef: 'audio/stop-7.mp3',
      durationMs: 45000,
      mimeType: 'audio/mpeg',
      errorMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  test('getAudio returns tenant-scoped audio', async () => {
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
          id: 12,
          variant_presentation_id: 7,
          status: 'pending',
          provider_key: 'noop',
          storage_ref: null,
          duration_ms: null,
          mime_type: null,
          error_message: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.getAudio({}, '1', '5', '7');

    expect(result.status).toBe('pending');
    expect(Database.get.mock.results[0].value.query.mock.calls[0][1]).toEqual(['7', '5', '1']);
  });

  test('getAudio returns not found when missing', async () => {
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

    await expect(model.getAudio({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('createAudio inserts audio with defaults', async () => {
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
          id: 12,
          variant_presentation_id: 7,
          status: 'pending',
          provider_key: 'noop',
          storage_ref: null,
          duration_ms: null,
          mime_type: null,
          error_message: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.createAudio({}, '1', '5', '7', {});

    expect(result.providerKey).toBe('noop');
    expect(result.status).toBe('pending');

    Database.get.mockReturnValue({
      query: jest.fn().mockRejectedValueOnce({ code: '23505' }),
    });

    await expect(model.createAudio({}, '1', '5', '7', {})).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('updateAudio updates metadata fields', async () => {
    jest.spyOn(model, 'getAudio').mockResolvedValue({
      id: '12',
      variantId: '7',
      stopId: '5',
      placeId: '1',
      status: 'pending',
      providerKey: 'noop',
      storageRef: null,
      durationMs: null,
      mimeType: null,
      errorMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    Database.get.mockReturnValue({
      query: jest.fn().mockResolvedValueOnce([
        {
          id: 12,
          variant_presentation_id: 7,
          status: 'ready',
          provider_key: 'noop',
          storage_ref: 'audio/stop-7.mp3',
          duration_ms: 30000,
          mime_type: 'audio/mpeg',
          error_message: null,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ]),
    });

    const result = await model.updateAudio({}, '1', '5', '7', {
      status: 'ready',
      storageRef: 'audio/stop-7.mp3',
      durationMs: 30000,
      mimeType: 'audio/mpeg',
    });

    expect(result.status).toBe('ready');
    expect(result.storageRef).toBe('audio/stop-7.mp3');
    expect(result.durationMs).toBe(30000);
  });

  test('updateAudio rejects invalid durationMs', async () => {
    jest.spyOn(model, 'getAudio').mockResolvedValue({
      id: '12',
      variantId: '7',
      stopId: '5',
      placeId: '1',
      status: 'pending',
      providerKey: 'noop',
      storageRef: null,
      durationMs: null,
      mimeType: null,
      errorMessage: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await expect(model.updateAudio({}, '1', '5', '7', { durationMs: -1 })).rejects.toBeInstanceOf(
      AppError,
    );
  });

  test('deleteAudio returns not found when scoped delete misses', async () => {
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

    await expect(model.deleteAudio({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('updateStop marks audio stale when canonicalNarrative changes', async () => {
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
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    Database.get.mockReturnValue({ query });

    await model.updateStop({}, '1', '5', { canonicalNarrative: 'New narrative' });

    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[1][0]).toContain("staleness_status = 'stale'");
    expect(query.mock.calls[2][0]).toContain("status = 'stale'");
    expect(query.mock.calls[2][0]).toContain('guide_audio');
  });
});
