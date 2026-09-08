// plugins/files/__tests__/cloudStorageController.test.js
jest.mock('@homebase/core', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  Context: {
    getUserId: jest.fn(() => 1),
  },
}));

const CloudStorageController = require('../cloudStorageController');

describe('CloudStorageController', () => {
  let model;
  let controller;
  let res;

  beforeEach(() => {
    model = {
      getSettings: jest.fn(),
    };
    controller = new CloudStorageController(model);
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test('rejects onedrive and dropbox', async () => {
    await controller.getSettings({ params: { service: 'onedrive' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    await controller.getSettings({ params: { service: 'dropbox' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('accepts googledrive', async () => {
    model.getSettings.mockResolvedValue(null);
    await controller.getSettings({ params: { service: 'googledrive' } }, res);
    expect(res.json).toHaveBeenCalledWith(null);
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});
