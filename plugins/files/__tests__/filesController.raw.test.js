// plugins/files/__tests__/filesController.raw.test.js
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Context: {
    getUserId: jest.fn(() => 1),
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

const fs = require('fs');
const path = require('path');
const os = require('os');
const FilesController = require('../controller');

describe('FilesController.raw', () => {
  let model;
  let filesService;
  let controller;
  let uploadRoot;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-files-'));
    model = {
      getByStoredFilename: jest.fn(),
      getById: jest.fn(),
    };
    filesService = {
      resolveExternalId: jest.fn(),
      deleteStoredBlob: jest.fn(),
    };
    controller = new FilesController(model, filesService);
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      sendFile: jest.fn(),
    };
  });

  afterEach(() => {
    fs.rmSync(uploadRoot, { recursive: true, force: true });
  });

  test('rejects googledrive rows', async () => {
    model.getByStoredFilename.mockResolvedValue({
      id: '1',
      name: 'doc.pdf',
      storageProvider: 'googledrive',
      mimeType: 'application/pdf',
    });
    await controller.raw({ params: { filename: 'x.pdf' } }, res, { uploadRoot });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('download') }),
    );
  });

  test('serves local file when present', async () => {
    const filename = 'stored.bin';
    const abs = path.join(uploadRoot, filename);
    fs.writeFileSync(abs, 'hello');
    model.getByStoredFilename.mockResolvedValue({
      id: '2',
      name: 'hello.txt',
      storageProvider: 'local',
      mimeType: 'text/plain',
      url: `/api/files/raw/${filename}`,
    });
    await controller.raw({ params: { filename } }, res, { uploadRoot });
    expect(res.sendFile).toHaveBeenCalledWith(abs);
  });
});
