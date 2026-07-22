const { AppError } = require('../../../server/core/errors/AppError');

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

jest.mock('../../../server/core/storage/registerDefaultAdapters', () => ({
  ensureStorageProvidersRegistered: jest.fn(),
}));

const mockDownload = jest.fn(async () => ({ pipe: jest.fn() }));
const mockDelete = jest.fn(async () => undefined);

jest.mock('../../../server/core/storage/StorageProviderRegistry', () => ({
  has: jest.fn(() => true),
  get: jest.fn(() => ({
    download: mockDownload,
    delete: mockDelete,
  })),
  resolveForUpload: jest.fn(),
}));

jest.mock('../audio/uploadAudioBuffer', () => ({
  uploadAudioBuffer: jest.fn(async () => ({
    providerKey: 'local',
    externalFileId: 'guides/audio/1-test.wav',
  })),
  GUIDE_AUDIO_KEY_PREFIX: 'guides/audio',
}));

jest.mock('../../ai-providers/AIProviderRouter', () => ({
  AIProviderRouter: jest.fn().mockImplementation(() => ({
    resolve: jest.fn(async () => null),
    settingsModel: {
      resolveRuntimeConfig: jest.fn(async () => null),
    },
  })),
}));

const AudioOrchestrationService = require('../audio/AudioOrchestrationService');
const GuidesModel = require('../model');
const { ensureAudioProvidersRegistered } = require('../audio/registerDefaultProviders');
const { createMinimalWavBuffer } = require('../audio/minimalWav');
const { uploadAudioBuffer } = require('../audio/uploadAudioBuffer');

describe('AudioOrchestrationService (presentation)', () => {
  const guidesModel = new GuidesModel();

  beforeAll(() => {
    ensureAudioProvidersRegistered();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    uploadAudioBuffer.mockResolvedValue({
      providerKey: 'local',
      externalFileId: 'guides/audio/1-test.wav',
    });
  });

  function createModel(overrides = {}) {
    return {
      getPresentationByLanguage: jest.fn(async () => ({
        id: '10',
        language: 'en',
        presentationText: 'Hello guide',
        approvalStatus: 'approved',
        ...overrides.presentation,
      })),
      getAudioIfExists: jest.fn(async () => overrides.existingAudio ?? null),
      getAudio: jest.fn(async (_req, placeId, language, options = {}) => {
        const audio = overrides.audio;
        if (!audio) {
          throw new AppError('Audio not found', 404, AppError.CODES.NOT_FOUND);
        }
        // Production path: DB row → transformAudioRow (strips restore hint unless preserved).
        return guidesModel.transformAudioRow(
          {
            id: audio.id,
            presentation_id: audio.presentationId || '10',
            status: audio.status,
            provider_key: audio.providerKey,
            storage_ref: audio.storageRef,
            duration_ms: audio.durationMs ?? null,
            mime_type: audio.mimeType ?? null,
            error_message: audio.errorMessage ?? null,
            cost: audio.cost ?? null,
            created_at: audio.createdAt,
            updated_at: audio.updatedAt,
          },
          placeId,
          language,
          options,
        );
      }),
      createAudio: jest.fn(async (_req, _placeId, _language, data = {}) => ({
        id: '1',
        presentationId: '10',
        placeId: '5',
        language: 'en',
        status: 'pending',
        providerKey: data.providerKey || 'noop',
        storageRef: null,
      })),
      setAudioGenerationState: jest.fn(async (_req, _placeId, _language, state) => ({
        id: '1',
        presentationId: '10',
        placeId: '5',
        language: 'en',
        providerKey: state.providerKey || 'noop',
        ...state,
      })),
      deleteAudioRecord: jest.fn(async () => ({ id: '1' })),
    };
  }

  test('generate requires presentation text', async () => {
    const model = createModel({
      presentation: { presentationText: '   ', approvalStatus: 'approved' },
    });
    const orch = new AudioOrchestrationService(model);
    await expect(orch.generate({}, '5', 'en')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('generate requires approved presentation', async () => {
    const model = createModel({
      presentation: { presentationText: 'Text', approvalStatus: 'draft' },
    });
    const orch = new AudioOrchestrationService(model);
    await expect(orch.generate({}, '5', 'en')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('generate uploads noop wav and marks ready', async () => {
    const model = createModel();
    const orch = new AudioOrchestrationService(model);
    const result = await orch.generate({}, '5', 'en');
    expect(uploadAudioBuffer).toHaveBeenCalled();
    expect(result.status).toBe('ready');
    expect(result.storageRef).toBe('local:guides/audio/1-test.wav');
    expect(model.createAudio).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({ providerKey: 'noop' }),
    );
    expect(model.setAudioGenerationState).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({ status: 'ready', providerKey: 'noop' }),
    );
  });

  test('preview allows stale audio', async () => {
    const model = createModel({
      audio: {
        id: '1',
        status: 'stale',
        storageRef: 'local:guides/audio/1-test.wav',
        mimeType: 'audio/wav',
        presentationId: '10',
      },
    });
    const orch = new AudioOrchestrationService(model);
    const preview = await orch.preview({}, '5', 'en');
    expect(preview.mimeType).toBe('audio/wav');
    expect(mockDownload).toHaveBeenCalled();
    expect(preview.stream).toBeTruthy();
  });

  test('createMinimalWavBuffer returns RIFF header', () => {
    const buf = createMinimalWavBuffer(1000);
    expect(buf.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(buf.length).toBeGreaterThan(44);
  });

  test('generate conflicts when already processing', async () => {
    const model = createModel({
      existingAudio: {
        id: '1',
        status: 'processing',
        providerKey: 'noop',
        storageRef: null,
      },
    });
    const orch = new AudioOrchestrationService(model);
    await expect(orch.generate({}, '5', 'en')).rejects.toBeInstanceOf(AppError);
  });

  test('generate keeps previous blob when provider fails', async () => {
    const previousRef = 'local:guides/audio/old.wav';
    const model = createModel({
      existingAudio: {
        id: '1',
        status: 'ready',
        providerKey: 'elevenlabs',
        storageRef: previousRef,
        durationMs: 1200,
        mimeType: 'audio/mpeg',
      },
    });
    const failingProvider = {
      name: 'elevenlabs',
      generate: jest.fn(async () => ({
        status: 'failed',
        errorMessage: 'quota_exceeded',
      })),
    };
    const orch = new AudioOrchestrationService(model, {
      audioProviderConfigResolver: {
        getPreferredProviderKey: jest.fn(async () => 'elevenlabs'),
        createProvider: jest.fn(async () => failingProvider),
      },
    });

    await expect(orch.generate({}, '5', 'en')).rejects.toMatchObject({
      message: 'quota_exceeded',
      statusCode: 502,
    });

    expect(mockDelete).not.toHaveBeenCalled();
    expect(model.setAudioGenerationState).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({
        status: 'ready',
        storageRef: previousRef,
        durationMs: 1200,
        mimeType: 'audio/mpeg',
        errorMessage: null,
      }),
    );
  });

  test('generate deletes previous blob only after successful upload', async () => {
    const previousRef = 'local:guides/audio/old.wav';
    const model = createModel({
      existingAudio: {
        id: '1',
        status: 'ready',
        providerKey: 'noop',
        storageRef: previousRef,
        durationMs: 500,
        mimeType: 'audio/wav',
      },
    });
    const orch = new AudioOrchestrationService(model);
    const result = await orch.generate({}, '5', 'en');
    expect(result.status).toBe('ready');
    expect(result.storageRef).toBe('local:guides/audio/1-test.wav');
    expect(mockDelete).toHaveBeenCalled();
  });

  test('cancel returns pending when processing', async () => {
    const model = createModel({
      audio: {
        id: '1',
        status: 'processing',
        providerKey: 'noop',
        storageRef: null,
        presentationId: '10',
      },
    });
    const orch = new AudioOrchestrationService(model);
    const result = await orch.cancel({}, '5', 'en');
    expect(result.status).toBe('pending');
    expect(model.setAudioGenerationState).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({ status: 'pending' }),
    );
  });

  test('cancel restores stale when regenerate of stale audio is cancelled', async () => {
    const previousRef = 'local:guides/audio/old.wav';
    const model = createModel({
      audio: {
        id: '1',
        status: 'processing',
        providerKey: 'noop',
        storageRef: previousRef,
        durationMs: 900,
        mimeType: 'audio/wav',
        errorMessage: '__hb_restore__:stale',
        presentationId: '10',
      },
    });
    const orch = new AudioOrchestrationService(model);
    const result = await orch.cancel({}, '5', 'en');
    expect(model.getAudio).toHaveBeenCalledWith({}, '5', 'en', { preserveRestoreHint: true });
    expect(result.status).toBe('stale');
    expect(model.setAudioGenerationState).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({
        status: 'stale',
        storageRef: previousRef,
        durationMs: 900,
        mimeType: 'audio/wav',
        errorMessage: null,
      }),
    );
  });

  test('cancel without preserveRestoreHint would lose stale (guard via transform path)', async () => {
    const previousRef = 'local:guides/audio/old.wav';
    const model = createModel({
      audio: {
        id: '1',
        status: 'processing',
        providerKey: 'noop',
        storageRef: previousRef,
        durationMs: 900,
        mimeType: 'audio/wav',
        errorMessage: '__hb_restore__:stale',
        presentationId: '10',
      },
    });
    // Simulate the bug: public getAudio strips hint → restore falls back to ready.
    const stripped = await model.getAudio({}, '5', 'en');
    expect(stripped.errorMessage).toBeNull();
    const preserved = await model.getAudio({}, '5', 'en', { preserveRestoreHint: true });
    expect(preserved.errorMessage).toBe('__hb_restore__:stale');
  });

  test('cancel restores ready when regenerate of ready audio is cancelled', async () => {
    const previousRef = 'local:guides/audio/old.wav';
    const model = createModel({
      audio: {
        id: '1',
        status: 'processing',
        providerKey: 'noop',
        storageRef: previousRef,
        durationMs: 900,
        mimeType: 'audio/wav',
        errorMessage: '__hb_restore__:ready',
        presentationId: '10',
      },
    });
    const orch = new AudioOrchestrationService(model);
    const result = await orch.cancel({}, '5', 'en');
    expect(result.status).toBe('ready');
    expect(model.setAudioGenerationState).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({
        status: 'ready',
        storageRef: previousRef,
        errorMessage: null,
      }),
    );
  });

  test('generate persists restore hint while processing', async () => {
    const previousRef = 'local:guides/audio/old.wav';
    const model = createModel({
      existingAudio: {
        id: '1',
        status: 'stale',
        providerKey: 'noop',
        storageRef: previousRef,
        durationMs: 500,
        mimeType: 'audio/wav',
      },
    });
    const orch = new AudioOrchestrationService(model);
    await orch.generate({}, '5', 'en');
    expect(model.setAudioGenerationState).toHaveBeenCalledWith(
      {},
      '5',
      'en',
      expect.objectContaining({
        status: 'processing',
        storageRef: previousRef,
        errorMessage: '__hb_restore__:stale',
      }),
    );
  });
});
