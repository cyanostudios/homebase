// plugins/files/__tests__/filesController.download.test.js
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

const mockDownload = jest.fn();
jest.mock('../../../server/core/storage/StorageProviderRegistry', () => ({
  resolveForUpload: jest.fn(),
  resolveForFileRow: jest.fn(() => ({
    name: 'local',
    download: (...args) => mockDownload(...args),
  })),
}));

const { PassThrough } = require('stream');
const FilesController = require('../controller');

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    destroy: jest.fn(),
  };
}

describe('FilesController.downloadById', () => {
  let model;
  let filesService;
  let controller;

  beforeEach(() => {
    jest.clearAllMocks();
    model = { getById: jest.fn() };
    filesService = {
      resolveExternalId: jest.fn(() => 'blob-1'),
    };
    controller = new FilesController(model, filesService);
    const stream = new PassThrough();
    mockDownload.mockResolvedValue(stream);
  });

  test('forces attachment for SVG even when inline=1 (F-SVG-1)', async () => {
    model.getById.mockResolvedValue({
      id: '9',
      name: 'evil.svg',
      mimeType: 'image/svg+xml',
      storageProvider: 'local',
    });
    const res = makeRes();
    await controller.downloadById({ params: { id: '9' }, query: { inline: '1' } }, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(/^attachment;/),
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  test('allows inline for safe image when inline=1', async () => {
    model.getById.mockResolvedValue({
      id: '3',
      name: 'photo.png',
      mimeType: 'image/png',
      storageProvider: 'local',
    });
    const res = makeRes();
    await controller.downloadById({ params: { id: '3' }, query: { inline: '1' } }, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(/^inline;/),
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
  });

  test('uses attachment by default without inline query', async () => {
    model.getById.mockResolvedValue({
      id: '4',
      name: 'photo.png',
      mimeType: 'image/png',
      storageProvider: 'local',
    });
    const res = makeRes();
    await controller.downloadById({ params: { id: '4' }, query: {} }, res);
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringMatching(/^attachment;/),
    );
  });
});
