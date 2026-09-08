// plugins/files/__tests__/filesService.test.js
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

jest.mock('../../../server/core/storage/StorageProviderRegistry', () => ({
  resolveForUpload: jest.fn(),
  resolveForFileRow: jest.fn(),
}));

jest.mock('../../../server/core/utils/uploadMimeValidation', () => ({
  validateUploadedFileMime: jest.fn().mockResolvedValue('image/png'),
}));

const FilesService = require('../filesService');
const { AppError } = require('../../../server/core/errors/AppError');
const StorageProviderRegistry = require('../../../server/core/storage/StorageProviderRegistry');

describe('FilesService', () => {
  let model;
  let attachmentModel;
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    model = {
      getById: jest.fn(),
      create: jest.fn(),
    };
    attachmentModel = {
      create: jest.fn(),
      findExisting: jest.fn(),
      getById: jest.fn(),
      delete: jest.fn(),
      listForEntity: jest.fn(),
    };
    service = new FilesService(model, attachmentModel);
  });

  test('attachFile returns created:true on new link', async () => {
    model.getById.mockResolvedValue({
      id: '10',
      name: 'a.png',
      size: 1,
      mimeType: 'image/png',
      url: '/api/files/raw/x',
      storageProvider: 'local',
      externalFileId: 'x',
    });
    attachmentModel.create.mockResolvedValue({ id: '99', fileId: '10' });

    const result = await service.attachFile(
      {},
      {
        pluginName: 'notes',
        entityId: '5',
        fileId: '10',
      },
    );

    expect(result.created).toBe(true);
    expect(result.row.attachmentId).toBe('99');
    expect(result.row.file.id).toBe('10');
  });

  test('attachFile is idempotent on unique violation', async () => {
    model.getById.mockResolvedValue({
      id: '10',
      name: 'a.png',
      size: 1,
      mimeType: 'image/png',
      url: null,
      storageProvider: 'local',
      externalFileId: null,
    });
    const uniq = new AppError('Failed to insert', 500, AppError.CODES.DATABASE_ERROR, {
      errorCode: '23505',
      constraint: 'idx_file_attachments_user_plugin_entity_file',
    });
    attachmentModel.create.mockRejectedValue(uniq);
    attachmentModel.findExisting.mockResolvedValue({
      id: '77',
      fileId: '10',
      pluginName: 'notes',
      entityId: '5',
    });

    const result = await service.attachFile(
      {},
      {
        pluginName: 'notes',
        entityId: '5',
        fileId: '10',
      },
    );

    expect(result.created).toBe(false);
    expect(result.row.attachmentId).toBe('77');
  });

  test('attachFile is idempotent on raw pg unique code', async () => {
    model.getById.mockResolvedValue({
      id: '10',
      name: 'a.png',
      size: 1,
      mimeType: 'image/png',
      url: null,
      storageProvider: 'local',
      externalFileId: null,
    });
    const uniq = new Error('duplicate');
    uniq.code = '23505';
    attachmentModel.create.mockRejectedValue(uniq);
    attachmentModel.findExisting.mockResolvedValue({
      id: '88',
      fileId: '10',
      pluginName: 'notes',
      entityId: '5',
    });

    const result = await service.attachFile(
      {},
      {
        pluginName: 'notes',
        entityId: '5',
        fileId: '10',
      },
    );

    expect(result.created).toBe(false);
    expect(result.row.attachmentId).toBe('88');
  });

  test('attachFile throws when file missing', async () => {
    model.getById.mockResolvedValue(null);
    await expect(
      service.attachFile({}, { pluginName: 'notes', entityId: '1', fileId: '9' }),
    ).rejects.toBeInstanceOf(AppError);
  });

  test('resolveExternalId prefers externalFileId then raw url basename', () => {
    expect(service.resolveExternalId({ externalFileId: 'drive-1' })).toBe('drive-1');
    expect(
      service.resolveExternalId({ url: '/api/files/raw/abc-file.pdf', externalFileId: null }),
    ).toBe('abc-file.pdf');
    expect(service.resolveExternalId({ url: 'https://other', externalFileId: null })).toBeNull();
  });

  test('deleteStoredBlob uses storage provider', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    StorageProviderRegistry.resolveForFileRow.mockReturnValue({ delete: del });
    await service.deleteStoredBlob(
      {},
      {
        id: '1',
        externalFileId: 'blob-1',
        storageProvider: 'local',
      },
    );
    expect(del).toHaveBeenCalledWith({}, { externalFileId: 'blob-1' });
  });
});
