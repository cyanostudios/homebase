// plugins/guides/__tests__/audio-model.test.js
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
const { ensureAudioProvidersRegistered } = require('../audio/registerDefaultProviders');

describe('GuidesModel guide audio', () => {
  let model;

  const presentation = {
    id: '20',
    masterGuideId: '10',
    placeId: '1',
    language: 'en',
    presentationText: 'Hello',
    publicationStatus: 'draft',
    stalenessStatus: 'fresh',
    approvalStatus: 'approved',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const audioRow = {
    id: 5,
    presentation_id: 20,
    status: 'pending',
    provider_key: 'noop',
    storage_ref: null,
    duration_ms: null,
    mime_type: null,
    error_message: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  beforeAll(() => {
    ensureAudioProvidersRegistered();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    model = new GuidesModel();
    jest.spyOn(model, 'getPresentationByLanguage').mockResolvedValue(presentation);
  });

  test('transformAudioRow maps presentation-scoped fields', () => {
    expect(model.transformAudioRow(audioRow, '1', 'en')).toEqual({
      id: '5',
      presentationId: '20',
      placeId: '1',
      language: 'en',
      status: 'pending',
      providerKey: 'noop',
      storageRef: null,
      durationMs: null,
      mimeType: null,
      errorMessage: null,
      cost: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  });

  test('transformAudioRow hides internal restore hint from errorMessage', () => {
    expect(
      model.transformAudioRow(
        {
          ...audioRow,
          status: 'processing',
          storage_ref: 'local:guides/audio/20.wav',
          error_message: '__hb_restore__:stale',
        },
        '1',
        'en',
      ).errorMessage,
    ).toBeNull();
  });

  test('transformAudioRow preserves restore hint when requested', () => {
    expect(
      model.transformAudioRow(
        {
          ...audioRow,
          status: 'processing',
          storage_ref: 'local:guides/audio/20.wav',
          error_message: '__hb_restore__:stale',
        },
        '1',
        'en',
        { preserveRestoreHint: true },
      ).errorMessage,
    ).toBe('__hb_restore__:stale');
  });

  test('getAudio with preserveRestoreHint keeps restore marker for cancel', async () => {
    const processingRow = {
      ...audioRow,
      status: 'processing',
      storage_ref: 'local:guides/audio/20.wav',
      error_message: '__hb_restore__:stale',
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([processingRow])
      .mockResolvedValueOnce([processingRow]);
    Database.get.mockReturnValue({ query });

    const stripped = await model.getAudio({}, '1', 'en');
    expect(stripped.errorMessage).toBeNull();

    const preserved = await model.getAudio({}, '1', 'en', { preserveRestoreHint: true });
    expect(preserved.errorMessage).toBe('__hb_restore__:stale');
  });

  test('createAudio rejects client storageRef', async () => {
    await expect(
      model.createAudio({}, '1', 'en', { storageRef: 'local:guides/audio/x.wav' }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('storageRef'),
    });
    expect(Database.get).not.toHaveBeenCalled();
  });

  test('createAudio rejects ready status', async () => {
    await expect(model.createAudio({}, '1', 'en', { status: 'ready' })).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('generate'),
    });
    expect(Database.get).not.toHaveBeenCalled();
  });

  test('createAudio inserts with presentation_id and null blob fields', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ ...audioRow }]);
    Database.get.mockReturnValue({ query });

    const result = await model.createAudio({}, '1', 'en', {});

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO guide_audio'), [
      '20',
      'pending',
      'noop',
    ]);
    expect(result.presentationId).toBe('20');
    expect(result.placeId).toBe('1');
    expect(result.language).toBe('en');
    expect(result.status).toBe('pending');
    expect(result.storageRef).toBeNull();
  });

  test('getAudio queries by presentation_id and place_id', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        ...audioRow,
        status: 'ready',
        storage_ref: 'local:guides/audio/20.wav',
        duration_ms: 1000,
        mime_type: 'audio/wav',
      },
    ]);
    Database.get.mockReturnValue({ query });

    const result = await model.getAudio({}, '1', 'en');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM guide_audio'), ['20', '1']);
    expect(result.status).toBe('ready');
    expect(result.presentationId).toBe('20');
    expect(result.storageRef).toBe('local:guides/audio/20.wav');
  });

  test('getAudioIfExists returns null on 404', async () => {
    jest
      .spyOn(model, 'getAudio')
      .mockRejectedValue(new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND));
    await expect(model.getAudioIfExists({}, '1', 'en')).resolves.toBeNull();
  });

  test('setAudioGenerationState updates scoped by presentation and place', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        ...audioRow,
        status: 'ready',
        storage_ref: 'local:guides/audio/20.wav',
        duration_ms: 1000,
        mime_type: 'audio/wav',
      },
    ]);
    Database.get.mockReturnValue({ query });

    const result = await model.setAudioGenerationState({}, '1', 'en', {
      status: 'ready',
      storageRef: 'local:guides/audio/20.wav',
      durationMs: 1000,
      mimeType: 'audio/wav',
      errorMessage: null,
    });

    expect(query.mock.calls[0][0]).toContain('UPDATE guide_audio');
    expect(query.mock.calls[0][0]).toContain('provider_key = COALESCE');
    expect(query.mock.calls[0][1]).toEqual([
      'ready',
      'local:guides/audio/20.wav',
      1000,
      'audio/wav',
      null,
      '20',
      '1',
      null,
      false,
      null,
    ]);
    expect(result.status).toBe('ready');
  });

  test('setAudioGenerationState persists providerKey when provided', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        id: 5,
        presentation_id: 20,
        status: 'processing',
        provider_key: 'noop',
        storage_ref: null,
        duration_ms: null,
        mime_type: null,
        error_message: null,
      },
    ]);
    Database.get.mockReturnValue({ query });

    await model.setAudioGenerationState({}, '1', 'en', {
      status: 'processing',
      providerKey: 'noop',
      storageRef: null,
      durationMs: null,
      mimeType: null,
      errorMessage: null,
    });

    expect(query.mock.calls[0][1][7]).toBe('noop');
  });

  test('setAudioGenerationState persists cost when provided', async () => {
    const query = jest.fn().mockResolvedValueOnce([
      {
        ...audioRow,
        status: 'ready',
        cost: { currency: 'USD', totalCost: 0.01, estimated: true },
      },
    ]);
    Database.get.mockReturnValue({ query });

    const cost = { currency: 'USD', totalCost: 0.01, estimated: true };
    await model.setAudioGenerationState({}, '1', 'en', {
      status: 'ready',
      storageRef: 'local:guides/audio/20.wav',
      durationMs: 1000,
      mimeType: 'audio/wav',
      errorMessage: null,
      cost,
    });

    expect(query.mock.calls[0][1][8]).toBe(true);
    expect(query.mock.calls[0][1][9]).toBe(JSON.stringify(cost));
  });

  test('sumPlaceEstimatedAudioCost returns null without currency rows', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total_cost: 0, currency: null, all_estimated: null }]);
    Database.get.mockReturnValue({ query });

    await expect(model.sumPlaceEstimatedAudioCost({}, '1')).resolves.toBeNull();
    expect(query.mock.calls[0][0]).toContain("ga.cost->>'totalCost'");
    expect(query.mock.calls[0][1]).toEqual(['1']);
  });

  test('sumPlaceEstimatedAudioCost sums cumulative audio costs', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ total_cost: '0.012345678', currency: 'USD', all_estimated: true }]);
    Database.get.mockReturnValue({ query });

    await expect(model.sumPlaceEstimatedAudioCost({}, '1')).resolves.toEqual({
      currency: 'USD',
      totalCost: 0.01234568,
      estimated: true,
    });
  });

  test('deleteAudioRecord deletes by presentation_id and place_id', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ id: 5 }]);
    Database.get.mockReturnValue({ query });

    const result = await model.deleteAudioRecord({}, '1', 'en');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM guide_audio'), [
      '20',
      '1',
    ]);
    expect(result).toEqual({ id: '5' });
  });

  test('updatePresentation marks ready audio stale when text changes', async () => {
    jest.spyOn(model, 'getPresentationByLanguage').mockResolvedValue({
      ...presentation,
      presentationText: 'Old text',
      approvalStatus: 'approved',
    });
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 20,
          master_guide_id: 10,
          language: 'en',
          presentation_text: 'New text',
          publication_status: 'draft',
          staleness_status: 'fresh',
          approval_status: 'approved',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);
    Database.get.mockReturnValue({ query });

    await model.updatePresentation({}, '1', 'en', { presentationText: 'New text' });

    const staleSql = query.mock.calls[1][0];
    expect(staleSql).toContain('UPDATE guide_audio');
    expect(staleSql).toContain("status = 'stale'");
    // Tenant filter resolves user_id via guide_places (guide_audio has no user_id column).
    expect(staleSql).toContain('guide_places');
    expect(staleSql).toContain('FROM guide_presentations');
    expect(query.mock.calls[1][1]).toEqual([20]);
  });

  test('updatePresentation does not mark audio stale when text unchanged', async () => {
    jest.spyOn(model, 'getPresentationByLanguage').mockResolvedValue({
      ...presentation,
      presentationText: 'Same',
      approvalStatus: 'approved',
    });
    const query = jest.fn().mockResolvedValueOnce([
      {
        id: 20,
        master_guide_id: 10,
        language: 'en',
        presentation_text: 'Same',
        publication_status: 'draft',
        staleness_status: 'fresh',
        approval_status: 'approved',
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-02T00:00:00.000Z',
      },
    ]);
    Database.get.mockReturnValue({ query });

    await model.updatePresentation({}, '1', 'en', { publicationStatus: 'ready' });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).not.toContain('guide_audio');
  });

  test('applyProductionPresentationText marks audio stale', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        {
          id: 20,
          master_guide_id: 10,
          language: 'en',
          presentation_text: 'Generated',
          publication_status: 'draft',
          staleness_status: 'fresh',
          approval_status: 'approved',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-02T00:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([]);
    Database.get.mockReturnValue({ query });

    await model.applyProductionPresentationText({}, '1', '20', 'Generated');

    const staleSql = query.mock.calls[1][0];
    expect(staleSql).toContain("status = 'stale'");
    expect(staleSql).toContain('guide_places');
    expect(staleSql).toContain('FROM guide_presentations');
    expect(query.mock.calls[1][1]).toEqual(['20']);
  });
});
