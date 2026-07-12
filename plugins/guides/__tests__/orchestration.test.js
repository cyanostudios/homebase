// plugins/guides/__tests__/orchestration.test.js
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

jest.mock('../audio/uploadAudioBuffer', () => ({
  uploadAudioBuffer: jest.fn().mockResolvedValue({
    providerKey: 'local',
    externalFileId: 'guide-audio-7.wav',
  }),
}));

const AudioOrchestrationService = require('../audio/AudioOrchestrationService');
const { ensureAudioProvidersRegistered } = require('../audio/registerDefaultProviders');
const { uploadAudioBuffer } = require('../audio/uploadAudioBuffer');

describe('AudioOrchestrationService', () => {
  let model;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    ensureAudioProvidersRegistered();
    model = {
      getVariantById: jest.fn(),
      getAudioIfExists: jest.fn(),
      getAudio: jest.fn(),
      createAudio: jest.fn(),
      setAudioGenerationState: jest.fn(),
      deleteAudioRecord: jest.fn(),
    };
    service = new AudioOrchestrationService(model);
  });

  test('generate rejects missing presentationText', async () => {
    model.getVariantById.mockResolvedValue({
      id: '7',
      presentationText: null,
      language: 'sv',
      variantType: 'normal',
    });

    await expect(service.generate({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test('generate returns 409 when already processing', async () => {
    model.getVariantById.mockResolvedValue({
      id: '7',
      presentationText: 'Hello',
      language: 'sv',
      variantType: 'normal',
    });
    model.getAudioIfExists.mockResolvedValue({
      id: '12',
      status: 'processing',
      providerKey: 'noop',
      storageRef: null,
    });

    await expect(service.generate({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('generate creates audio, uploads, and sets ready via noop provider', async () => {
    model.getVariantById.mockResolvedValue({
      id: '7',
      presentationText: 'Hello world',
      language: 'sv',
      variantType: 'normal',
    });
    model.getAudioIfExists.mockResolvedValue(null);
    model.createAudio.mockResolvedValue({
      id: '12',
      status: 'pending',
      providerKey: 'noop',
      storageRef: null,
    });
    model.setAudioGenerationState
      .mockResolvedValueOnce({ id: '12', status: 'processing' })
      .mockResolvedValueOnce({
        id: '12',
        status: 'ready',
        storageRef: 'local:guide-audio-7.wav',
        mimeType: 'audio/wav',
        durationMs: 1000,
      });

    const result = await service.generate({}, '1', '5', '7');

    expect(model.createAudio).toHaveBeenCalled();
    expect(uploadAudioBuffer).toHaveBeenCalled();
    expect(result.status).toBe('ready');
    expect(result.storageRef).toBe('local:guide-audio-7.wav');
  });

  test('cancel requires processing status', async () => {
    model.getAudio.mockResolvedValue({ id: '12', status: 'ready', providerKey: 'noop' });

    await expect(service.cancel({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('preview rejects non-ready audio', async () => {
    model.getAudio.mockResolvedValue({ id: '12', status: 'processing', storageRef: null });

    await expect(service.preview({}, '1', '5', '7')).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test('deleteWithBlob removes storage then record', async () => {
    const deleteStoredSpy = jest.spyOn(service, 'deleteStoredBlob').mockResolvedValue(undefined);
    model.getAudioIfExists.mockResolvedValue({
      id: '12',
      storageRef: 'local:guide-audio-7.wav',
    });
    model.deleteAudioRecord.mockResolvedValue({ id: '12' });

    await service.deleteWithBlob({}, '1', '5', '7');

    expect(deleteStoredSpy).toHaveBeenCalledWith({}, 'local:guide-audio-7.wav');
    expect(model.deleteAudioRecord).toHaveBeenCalledWith({}, '1', '5', '7');
  });
});

describe('NoopAudioProvider generate', () => {
  test('returns audio buffer for orchestration', async () => {
    const NoopAudioProvider = require('../audio/adapters/NoopAudioProvider');
    const provider = new NoopAudioProvider();
    const result = await provider.generate({}, { variantPresentationId: 7 });
    expect(result.status).toBe('ready');
    expect(Buffer.isBuffer(result.audioBuffer)).toBe(true);
    expect(result.mimeType).toBe('audio/wav');
  });
});
